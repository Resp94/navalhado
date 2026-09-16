import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/data-display/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/feedback/Card';
import './Relatorios.css';

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
 * chama nenhum contrato. Só Faturamento por período tem link real neste
 * ticket; os outros nove aparecem marcados "em breve".
 */
const CATALOGO: CatalogoGrupo[] = [
  {
    page: 'Faturamento',
    reports: [
      { question: 'Quanto faturei e como foi em relação ao período anterior?', path: '/relatorios/faturamento' },
      { question: 'Quanto entrou em cada forma de pagamento?' },
      { question: 'O ticket médio dos clientes está subindo ou caindo?' },
    ],
  },
  {
    page: 'Equipe e Serviços',
    reports: [
      { question: 'Quem são os profissionais que mais produzem?' },
      { question: 'Quais serviços sustentam a barbearia?' },
    ],
  },
  {
    page: 'Agenda',
    reports: [
      { question: 'Quantos agendamentos viraram atendimento, cancelamento ou falta?' },
      { question: 'Quais dias e horários têm mais demanda?' },
    ],
  },
  {
    page: 'Clientes',
    reports: [
      { question: 'Quantos clientes são novos e quantos são recorrentes?' },
      { question: 'De onde vêm os clientes da barbearia?' },
    ],
  },
  {
    page: 'Clientes sem Retorno',
    reports: [{ question: 'Quais clientes passaram do prazo de retorno sem voltar?' }],
  },
];

export const RelatoriosCatalogo: React.FC = () => {
  return (
    <div className="relatorios-catalogo-grupos">
      {CATALOGO.map((grupo) => (
        <Card key={grupo.page} variant="outline" aria-label={grupo.page}>
          <CardHeader>
            <CardTitle>{grupo.page}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="relatorios-catalogo-lista">
              {grupo.reports.map((report) => (
                <li key={report.question}>
                  {report.path ? (
                    <Link to={report.path} className="relatorios-catalogo-item">
                      {report.question}
                    </Link>
                  ) : (
                    <span className="relatorios-catalogo-item relatorios-catalogo-item--disabled">
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
