export interface ClientMigrationFields {
  migracionElegible?: boolean;
  migracionActiva?: boolean;
  migracionDesdeCuota?: number;
  versionCronogramaMigracion?: string;
  migracionActualizadaEn?: string;
}

export interface ClientMigrationState {
  migracionActiva: boolean;
  migracionDesdeCuota: number;
  versionCronogramaMigracion: string;
  migracionActualizadaEn: string;
}

export interface NumberedInstallment {
  numero: number;
  estado?: string;
}

export interface MigrationAwareClient extends ClientMigrationFields {
  versionCronograma?: string;
}

export type PaymentScheduleSectionKind = 'base' | 'migration';

export interface PaymentScheduleSection<T extends NumberedInstallment> {
  kind: PaymentScheduleSectionKind;
  installments: T[];
}

export const getRegularInstallmentNumbers = (installments: NumberedInstallment[] = []): number[] => (
  installments
    .map((installment) => installment.numero)
    .filter((number) => Number.isInteger(number) && number > 0)
    .sort((a, b) => a - b)
);

export const getSuggestedMigrationStart = (installments: NumberedInstallment[] = []): number => {
  const regularInstallments = installments
    .filter((installment) => Number.isInteger(installment.numero) && installment.numero > 0)
    .sort((a, b) => a.numero - b.numero);

  const firstUnpaid = regularInstallments.find((installment) => installment.estado !== 'pagado');
  return firstUnpaid?.numero ?? regularInstallments[regularInstallments.length - 1]?.numero ?? 1;
};

export const clampMigrationStart = (
  requestedStart: number,
  installments: NumberedInstallment[] = []
): number => {
  const numbers = getRegularInstallmentNumbers(installments);
  if (numbers.length === 0) return 1;

  const minimum = numbers[0];
  const maximum = numbers[numbers.length - 1];
  const normalized = Number.isFinite(requestedStart) ? Math.round(requestedStart) : minimum;
  const bounded = Math.min(maximum, Math.max(minimum, normalized));

  return numbers.reduce((closest, current) => (
    Math.abs(current - bounded) < Math.abs(closest - bounded) ? current : closest
  ), minimum);
};

export const isLegacyMigrationEligible = (
  client: MigrationAwareClient,
  currentScheduleVersion: string
): boolean => (
  typeof client.migracionElegible === 'boolean'
    ? client.migracionElegible
    : client.versionCronograma !== currentScheduleVersion
);

export const isMigrationEnabled = (
  client: MigrationAwareClient,
  currentScheduleVersion: string
): boolean => (
  isLegacyMigrationEligible(client, currentScheduleVersion) &&
  client.migracionActiva === true &&
  Number.isInteger(client.migracionDesdeCuota) &&
  Number(client.migracionDesdeCuota) > 0 &&
  Boolean(client.versionCronogramaMigracion)
);

export const isMigratedInstallment = (
  client: MigrationAwareClient,
  installmentNumber: number,
  currentScheduleVersion: string
): boolean => (
  isMigrationEnabled(client, currentScheduleVersion) &&
  installmentNumber > 0 &&
  installmentNumber >= Number(client.migracionDesdeCuota)
);

export const getEffectiveScheduleVersion = (
  client: MigrationAwareClient,
  installmentNumber: number,
  currentScheduleVersion: string
): string | undefined => (
  isMigratedInstallment(client, installmentNumber, currentScheduleVersion)
    ? client.versionCronogramaMigracion
    : client.versionCronograma
);

export const splitInstallmentsByMigration = <T extends NumberedInstallment>(
  client: MigrationAwareClient,
  installments: T[],
  currentScheduleVersion: string
): PaymentScheduleSection<T>[] => {
  if (!isMigrationEnabled(client, currentScheduleVersion)) {
    return installments.length > 0 ? [{ kind: 'base', installments: [...installments] }] : [];
  }

  const base = installments.filter((installment) => (
    !isMigratedInstallment(client, installment.numero, currentScheduleVersion)
  ));
  const migration = installments.filter((installment) => (
    isMigratedInstallment(client, installment.numero, currentScheduleVersion)
  ));
  const sections: PaymentScheduleSection<T>[] = [];

  if (base.length > 0) sections.push({ kind: 'base', installments: base });
  if (migration.length > 0) sections.push({ kind: 'migration', installments: migration });

  return sections;
};
