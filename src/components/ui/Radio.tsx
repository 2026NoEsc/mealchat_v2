import { ChoiceControl, ChoiceProps } from './ChoiceControl';

export type RadioProps = ChoiceProps & { selected: boolean; onSelect: () => void };

/** Target: Radio 493:1059. The caller owns the group's mutually exclusive value. */
export function Radio({ selected, onSelect, ...rest }: RadioProps) {
  return <ChoiceControl {...rest} kind="radio" checked={selected} onPress={onSelect} />;
}

export default Radio;
