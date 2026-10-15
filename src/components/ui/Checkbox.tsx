import { ChoiceControl, ChoiceProps } from './ChoiceControl';

export type CheckboxProps = ChoiceProps & { checked: boolean; onChange: (checked: boolean) => void };

/** Targets: 597:2227 / 597:2231. */
export function Checkbox({ checked, onChange, ...rest }: CheckboxProps) {
  return <ChoiceControl {...rest} kind="checkbox" checked={checked} onPress={() => onChange(!checked)} />;
}

export default Checkbox;
