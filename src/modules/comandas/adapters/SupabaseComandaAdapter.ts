import { supabase } from '../../../lib/supabase';
import type { Comanda, ComandaItem, CriarComandaInput, IComandaAdapter, LiquidarComandaInput } from '../types';

export class SupabaseComandaAdapter implements IComandaAdapter {
  async obterPorId(comandaId: string): Promise<Comanda | null> {
    const { data: comanda, error } = await supabase
      .from('comandas')
      .select('*, itens:comanda_itens(*), pagamentos:comanda_pagamentos(*)')
      .eq('id', comandaId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar comanda: ${error.message}`);
    }

    return comanda as Comanda | null;
  }

  async obterPorAppointmentId(appointmentId: string): Promise<Comanda | null> {
    const { data: comanda, error } = await supabase
      .from('comandas')
      .select('*, itens:comanda_itens(*), pagamentos:comanda_pagamentos(*)')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar comanda por agendamento: ${error.message}`);
    }

    return comanda as Comanda | null;
  }

  async listarAbertas(tenantId: string): Promise<Comanda[]> {
    const { data, error } = await supabase
      .from('comandas')
      .select('*, itens:comanda_itens(*)')
      .eq('tenant_id', tenantId)
      .eq('status', 'aberta')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao listar comandas abertas: ${error.message}`);
    }

    return (data || []) as Comanda[];
  }

  async listarTodas(tenantId: string): Promise<import('../types').ComandaEnriched[]> {
    const { data, error } = await supabase
      .from('comandas')
      .select(`
        *,
        itens:comanda_itens(*),
        customer:customers(id, name, phone),
        appointment:appointments(
          id,
          start_time,
          is_fitting,
          service:services(id, name),
          professional:professionals(id, name)
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Erro ao listar comandas: ${error.message}`);
    }

    interface RawComandaListRow extends Comanda {
      customer?: { id: string; name: string; phone: string | null } | null;
      appointment?: {
        id: string;
        start_time: string;
        is_fitting: boolean | null;
        service?: { id: string; name: string } | null;
        professional?: { id: string; name: string } | null;
      } | {
        id: string;
        start_time: string;
        is_fitting: boolean | null;
        service?: { id: string; name: string } | null;
        professional?: { id: string; name: string } | null;
      }[] | null;
    }

    return ((data as unknown as RawComandaListRow[]) || []).map((c) => {
      const isAberta = c.status === 'aberta' || (c.status as string) === 'open';
      const isFechada = c.status === 'fechada' || (c.status as string) === 'closed' || (c.status as string) === 'paid';
      const normalizedStatus = isAberta ? 'aberta' : isFechada ? 'fechada' : 'cancelada';
      const appointment = Array.isArray(c.appointment) ? c.appointment[0] || null : c.appointment;

      return {
        ...c,
        status: normalizedStatus,
        customer_name: c.customer?.name || (c.appointment_id ? 'Cliente Agendado' : 'Cliente Balcão'),
        customer_phone: c.customer?.phone || null,
        professional_name: appointment?.professional?.name || 'Equipe',
        appointment_start_time: appointment?.start_time || null,
        appointment_service_name: appointment?.service?.name || null,
        appointment_is_fitting: appointment?.is_fitting ?? null,
      };
    });
  }

  async criarComanda(input: CriarComandaInput): Promise<Comanda> {
    const totalItens = input.itens.reduce((acc, item) => acc + item.quantity * item.unit_price, 0);

    const { data: comanda, error: comandaError } = await supabase
      .from('comandas')
      .insert({
        tenant_id: input.tenant_id,
        appointment_id: input.appointment_id || null,
        customer_id: input.customer_id || null,
        status: 'aberta',
        total_amount: totalItens,
        discount_amount: 0,
        tip_amount: 0,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (comandaError || !comanda) {
      throw new Error(`Erro ao criar comanda: ${comandaError?.message}`);
    }

    if (input.itens.length > 0) {
      const itensPayload = input.itens.map((i) => ({
        comanda_id: comanda.id,
        tenant_id: input.tenant_id,
        item_type: i.item_type,
        service_id: i.service_id || null,
        product_id: i.product_id || null,
        professional_id: i.professional_id || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: Number((i.quantity * i.unit_price).toFixed(2)),
      }));

      const { data: itens, error: itensError } = await supabase
        .from('comanda_itens')
        .insert(itensPayload)
        .select();

      if (itensError) {
        throw new Error(`Erro ao inserir itens da comanda: ${itensError.message}`);
      }

      comanda.itens = itens;
    }

    return comanda as Comanda;
  }

  async adicionarItem(
    comandaId: string,
    tenantId: string,
    item: Omit<ComandaItem, 'id' | 'comanda_id' | 'tenant_id'>
  ): Promise<ComandaItem> {
    const totalPrice = Number((item.quantity * item.unit_price).toFixed(2));

    const { data, error } = await supabase
      .from('comanda_itens')
      .insert({
        comanda_id: comandaId,
        tenant_id: tenantId,
        item_type: item.item_type,
        service_id: item.service_id || null,
        product_id: item.product_id || null,
        professional_id: item.professional_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: totalPrice,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Erro ao adicionar item na comanda: ${error?.message}`);
    }

    // Recalcular e persistir total_amount atualizado da comanda
    const { data: todosItens } = await supabase
      .from('comanda_itens')
      .select('total_price')
      .eq('comanda_id', comandaId);

    const novoTotal = (todosItens || []).reduce((acc, it) => acc + Number(it.total_price || 0), 0);
    await supabase.from('comandas').update({ total_amount: novoTotal }).eq('id', comandaId);

    return data as ComandaItem;
  }

  async removerItem(itemId: string, comandaId: string): Promise<void> {
    const { error } = await supabase
      .from('comanda_itens')
      .delete()
      .eq('id', itemId)
      .eq('comanda_id', comandaId);

    if (error) {
      throw new Error(`Erro ao remover item da comanda: ${error.message}`);
    }

    // Recalcular e persistir total_amount atualizado da comanda
    const { data: todosItens } = await supabase
      .from('comanda_itens')
      .select('total_price')
      .eq('comanda_id', comandaId);

    const novoTotal = (todosItens || []).reduce((acc, it) => acc + Number(it.total_price || 0), 0);
    await supabase.from('comandas').update({ total_amount: novoTotal }).eq('id', comandaId);
  }

  async liquidarComanda(input: LiquidarComandaInput): Promise<Comanda> {
    const operationId = input.comanda_id ?? globalThis.crypto.randomUUID();
    const { data, error } = await supabase.rpc('settle_comanda_idempotent', {
      p_operation_id: operationId,
      p_comanda_id: operationId,
      p_tenant_id: input.tenant_id,
      p_appointment_id: input.appointment_id ?? null,
      p_customer_id: input.customer_id ?? null,
      p_discount_amount: input.discount_amount ?? 0,
      p_tip_amount: input.tip_amount ?? 0,
      p_cash_session_id: input.cash_session_id ?? null,
      p_itens: input.itens ?? [],
      p_pagamentos: input.pagamentos,
    });

    if (error || !data) {
      throw new Error(`Erro ao finalizar comanda: ${error?.message || 'resposta vazia'}`);
    }

    return data as Comanda;
  }

  async reabrirComanda(comandaId: string, tenantId: string): Promise<Comanda> {
    const { data, error } = await supabase.rpc('reopen_comanda', {
      p_comanda_id: comandaId,
      p_tenant_id: tenantId,
    });

    if (error || !data) {
      throw new Error(`Erro ao reabrir comanda: ${error?.message || 'resposta vazia'}`);
    }

    return data as Comanda;
  }
}
