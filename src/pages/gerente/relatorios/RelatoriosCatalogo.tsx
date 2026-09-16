import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/data-display/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/feedback/Card';

interface CatalogoRelatorio {
  question: string;
  path?: string;
}

interface CatalogoGrupo {
  page: string;
  reports: CatalogoRelatorio[];
}

/**
 * Catálogo do Módulo de Relatórios (spec 038, "Posição no produto",
 * "Catálogo sem números"): lista os dez relatórios agrupados pelas cinco
 * páginas, cada um com uma frase de pergunta, sem nenhum número -- não
 * chama nenhum contrato. Os dez relatórios (tickets 01-11) têm link real;
 * cada pergunta aponta para a página que já responde essa pergunta, mesmo
 * quando duas ou três perguntas dividem a mesma página/contrato
 * (Faturamento serve 1-3 pela mesma RPC; Agenda serve 6-7; Clientes serve
 * 9-10).
 */
const CATALOGO: CatalogoGrupo[] = [
  {
    page: 'Faturamento',
    reports: [
      { question: 'Quanto faturei e como foi em relação ao período anterior?', path: '/relatorios/faturamento' },
      { question: 'Quanto entrou em cada forma de pagamento?', path: '/relatorios/faturamento' },
      { question: 'O ticket médio dos clientes está subindo ou caindo?', path: '/relatorios/faturamento' },
    ],
  },
  {
    page: 'Equipe e Serviços',
    reports: [
      { question: 'Quem são os profissionais que mais produzem?', path: '/relatorios/equipe-e-servicos' },
      { question: 'Quais serviços sustentam a barbearia?', path: '/relatorios/equipe-e-servicos' },
    ],
  },
  {
    page: 'Agenda',
    reports: [
      { question: 'Quantos agendamentos viraram atendimento, cancelamento ou falta?', path: '/relatorios/agenda' },
      { question: 'Quais dias e horários têm mais demanda?', path: '/relatorios/agenda' },
    ],
  },
  {
    page: 'Clientes',
    reports: [
      { question: 'Quantos clientes são novos e quantos são recorrentes?', path: '/relatorios/clientes' },
      { question: 'De onde vêm os clientes da barbearia?', path: '/relatorios/clientes' },
    ],
  },
  {
    page: 'Clientes sem Retorno',
    reports: [
      {
        question: 'Quais clientes passaram do prazo de retorno sem voltar?',
        path: '/relatorios/clientes-sem-retorno',
      },
    ],
  },
];

export const RelatoriosCatalogo: React.FC = () => {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
      {CATALOGO.map((grupo) => (
        <Card key={grupo.page} variant="outline" aria-label={grupo.page}>
          <CardHeader>
            <CardTitle>{grupo.page}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {grupo.reports.map((report) => (
                <li key={report.question}>
                  {report.path ? (
                    <Link
                      to={report.path}
                      className="flex items-center justify-between gap-3 px-3 py-[0.6rem] rounded-md bg-bg-primary text-sm text-text-primary no-underline hover:bg-brand-lightest hover:text-brand-deep"
                    >
                      {report.question}
                    </Link>
                  ) : (
                    <span className="flex items-center justify-between gap-3 px-3 py-[0.6rem] rounded-md bg-bg-primary text-sm text-text-secondary opacity-70">
                      {report.question}
                      <Badge variant="neutral" size="xs">em breve</Badge>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
