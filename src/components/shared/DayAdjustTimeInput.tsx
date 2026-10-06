import React from 'react';
import { TimePicker } from './TimePicker';

interface DayAdjustTimeInputProps {
  value: string;
  onChange: (time: string) => void;
  fieldKey: string;
}

/** Campo de horário da tabela de ajuste — usa o mesmo TimePicker do restante do app */
export const DayAdjustTimeInput: React.FC<DayAdjustTimeInputProps> = ({
  value,
  onChange,
  fieldKey,
}) => (
  <TimePicker
    compact
    pickerKey={fieldKey}
    label=""
    value={value}
    onSelect={onChange}
    placeholder="00:00"
  />
);
