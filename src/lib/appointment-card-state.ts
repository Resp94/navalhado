export type AppointmentCardState =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'fitting'
  | 'no_show';

export interface AppointmentCardStateInput {
  isFitting: boolean;
  appointmentStatus: string;
  paymentStatus: string;
}

/** Centraliza a decisão visual compartilhada pelas grades desktop e mobile. */
export const getAppointmentCardState = ({
  isFitting,
  appointmentStatus,
  paymentStatus,
}: AppointmentCardStateInput): AppointmentCardState => {
  if (appointmentStatus === 'no_show') return 'no_show';
  if (
    (isFitting && appointmentStatus === 'completed' && paymentStatus === 'paid') ||
    (!isFitting && (paymentStatus === 'paid' || appointmentStatus === 'completed'))
  ) {
    return 'completed';
  }
  if (appointmentStatus === 'in_progress') return 'in_progress';
  if (isFitting) return 'fitting';
  if (appointmentStatus === 'confirmed') return 'confirmed';
  return 'pending';
};
