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
      } | null;
    }

    return ((data as unknown as RawComandaListRow[]) || []).map((c) => {
      const isAberta = c.status === 'aberta' || (c.status as string) === 'open';
      const isFechada = c.status === 'fechada' || (c.status as string) === 'closed' || (c.status as string) === 'paid';
      const normalizedStatus = isAberta ? 'aberta' : isFechada ? 'fechada' : 'cancelada';

      return {
        ...c,
        status: normalizedStatus,
        customer_name: c.customer?.name || (c.appointment_id ? 'Cliente Agendado' : 'Cliente Balcão'),
        customer_phone: c.customer?.phone || null,
        professional_name: c.appointment?.professional?.name || 'Equipe',
        appointment_start_time: c.appointment?.start_time || null,
        appointment_service_name: c.appointment?.service?.name || null,
        appointment_is_fitting: c.appointment?.is_fitting ?? null,
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
  }

  async liquidarComanda(input: LiquidarComandaInput): Promise<Comanda> {
    const { data: comandaAtual, error: fetchError } = await supabase
      .from('comandas')
      .select('*, itens:comanda_itens(*)')
      .eq('id', input.comanda_id)
      .single();

    if (fetchError || !comandaAtual) {
      throw new Error(`Comanda não encontrada: ${fetchError?.message}`);
    }

    const subtotal = (comandaAtual.itens || []).reduce(
      (acc: number, item: ComandaItem) => acc + item.total_price,
      0
    );
    const discount = input.discount_amount || 0;
    const tip = input.tip_amount || 0;
    const totalLiquidado = Number((subtotal - discount + tip).toFixed(2));

    // Registrar pagamentos
    const pagamentosPayload = input.pagamentos.map((p) => {
      const change = p.payment_method === 'cash' && p.received_cash && p.received_cash > p.amount
        ? Number((p.received_cash - p.amount).toFixed(2))
        : 0;

      return {
        comanda_id: input.comanda_id,
        tenant_id: input.tenant_id,
        cash_session_id: input.cash_session_id || null,
        payment_method: p.payment_method,
        amount: p.amount,
        change_amount: change,
      };
    });

    const { error: pagamentosError } = await supabase
      .from('comanda_pagamentos')
      .insert(pagamentosPayload);

    if (pagamentosError) {
      throw new Error(`Erro ao registrar pagamentos: ${pagamentosError.message}`);
    }

    // Abater estoque de produtos consumidos
    if (comandaAtual.itens && comandaAtual.itens.length > 0) {
      for (const item of comandaAtual.itens) {
        if (item.item_type === 'produto' && item.product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (prod) {
            const newStock = Math.max(0, prod.stock_quantity - item.quantity);
            await supabase
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', item.product_id);
          }
        }
      }
    }

    // Atualizar status da comanda para fechada
    const { data: comandaFechada, error: closeError } = await supabase
      .from('comandas')
      .update({
        status: 'fechada',
        total_amount: totalLiquidado,
        discount_amount: discount,
        tip_amount: tip,
        closed_at: new Date().toISOString(),
      })
      .eq('id', input.comanda_id)
      .select('*, itens:comanda_itens(*), pagamentos:comanda_pagamentos(*)')
      .single();

    if (closeError || !comandaFechada) {
      throw new Error(`Erro ao finalizar comanda: ${closeError?.message}`);
    }

    // Se a comanda estiver vinculada a um agendamento, transicionar o agendamento para completed
    if (comandaFechada.appointment_id) {
      await supabase
        .from('appointments')
        .update({ status: 'completed', payment_status: 'paid' })
        .eq('id', comandaFechada.appointment_id);
    }

    return comandaFechada as Comanda;
  }

  async reabrirComanda(comandaId: string, _tenantId: string): Promise<Comanda> {
    // 1. Obter comanda atual com itens e pagamentos
    const { data: comandaAtual, error: fetchError } = await supabase
      .from('comandas')
      .select('*, itens:comanda_itens(*), pagamentos:comanda_pagamentos(*)')
      .eq('id', comandaId)
      .single();

    if (fetchError || !comandaAtual) {
      throw new Error(`Comanda não encontrada: ${fetchError?.message}`);
    }

    // 2. Devolver estoque de produtos se houver
    if (comandaAtual.itens && comandaAtual.itens.length > 0) {
      for (const item of comandaAtual.itens) {
        if (item.item_type === 'produto' && item.product_id) {
          const { data: prod } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single();

          if (prod) {
            await supabase
              .from('products')
              .update({ stock_quantity: prod.stock_quantity + item.quantity })
              .eq('id', item.product_id);
          }
        }
      }
    }

    // 3. Excluir pagamentos registrados
    const { error: delPagError } = await supabase
      .from('comanda_pagamentos')
      .delete()
      .eq('comanda_id', comandaId);

    if (delPagError) {
      console.error('Erro ao excluir pagamentos ao reabrir comanda:', delPagError);
    }

    // 4. Atualizar comanda para status 'aberta'
    const { data: comandaReaberta, error: updateError } = await supabase
      .from('comandas')
      .update({
        status: 'aberta',
        closed_at: null,
      })
      .eq('id', comandaId)
      .select('*, itens:comanda_itens(*)')
      .single();

    if (updateError || !comandaReaberta) {
      throw new Error(`Erro ao reabrir comanda: ${updateError?.message}`);
    }

    // 5. Se vinculado a um agendamento, voltar agendamento para 'confirmed' / payment_status 'pending'
    if (comandaAtual.appointment_id) {
      await supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          payment_status: 'pending',
        })
        .eq('id', comandaAtual.appointment_id);
    }

    return comandaReaberta as Comanda;
  }
}
