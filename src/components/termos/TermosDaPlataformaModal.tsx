import React from 'react';
import { Modal } from '../Modal';
import { textoDoDocumento } from '../../modules/termos/textos';
import type { DocumentoLegal } from '../../modules/termos/types';
import { TextoDosTermos } from './TextoDosTermos';

interface TermosDaPlataformaModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: DocumentoLegal;
}

/**
 * Os Termos de Uso e a Política de Privacidade da plataforma, que quem administra a barbearia aceita (cadastro, login e tela de
 * aceite). O Canal do Cliente tem o próprio texto (`LegalModal`): o cliente da barbearia não contrata a assinatura.
 */
export const TermosDaPlataformaModal: React.FC<TermosDaPlataformaModalProps> = ({ isOpen, onClose, documento }) => {
  const texto = textoDoDocumento(documento);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={texto.titulo}>
      <TextoDosTermos texto={texto} />
    </Modal>
  );
};
