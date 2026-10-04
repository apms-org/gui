import type * as React from 'react';

export type IconName = 'activity' | 'archive' | 'arrow-left' | 'arrow-right' | 'arrow-up-down' | 'arrow-up-right' | 'at-sign' | 'award' | 'badge-check' | 'bell' | 'book-open' | 'bot' | 'building-2' | 'calendar' | 'check' | 'check-check' | 'chevron-down' | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'chevrons-up-down' | 'circle-alert' | 'circle-check' | 'circle-dot' | 'circle-help' | 'circle-x' | 'clock' | 'cloud' | 'cloud-check' | 'cloud-off' | 'cloud-upload' | 'command' | 'contact' | 'container' | 'copy' | 'copy-plus' | 'cpu' | 'credit-card' | 'dices' | 'download' | 'ellipsis' | 'ellipsis-vertical' | 'eraser' | 'external-link' | 'eye' | 'eye-off' | 'file' | 'file-archive' | 'file-down' | 'file-key' | 'file-lock-2' | 'file-text' | 'file-up' | 'files' | 'filter' | 'fingerprint' | 'folder' | 'folder-open' | 'folder-plus' | 'gauge' | 'git-branch' | 'git-commit-horizontal' | 'globe' | 'globe-lock' | 'hard-drive' | 'hash' | 'heart-pulse' | 'history' | 'house' | 'id-card' | 'image' | 'info' | 'key' | 'key-round' | 'key-square' | 'keyboard' | 'landmark' | 'laptop' | 'layers' | 'layout-grid' | 'life-buoy' | 'link-2' | 'list' | 'list-filter' | 'lock' | 'lock-keyhole' | 'lock-open' | 'log-in' | 'log-out' | 'mail' | 'map-pin' | 'maximize-2' | 'minus' | 'monitor' | 'moon' | 'mouse-pointer-click' | 'music' | 'network' | 'package' | 'palette' | 'panel-left' | 'pencil' | 'phone' | 'pill' | 'plane' | 'plug' | 'plus' | 'power' | 'puzzle' | 'qr-code' | 'radar' | 'refresh-ccw' | 'refresh-cw' | 'rotate-ccw' | 'rotate-cw' | 'save' | 'scale' | 'scroll-text' | 'search' | 'send' | 'server' | 'settings' | 'shield' | 'shield-alert' | 'shield-check' | 'shield-off' | 'ship-wheel' | 'sliders-horizontal' | 'smartphone' | 'sparkles' | 'square-pen' | 'star' | 'sticky-note' | 'store' | 'sun' | 'tag' | 'terminal' | 'terminal-square' | 'ticket' | 'timer' | 'trash' | 'trash-2' | 'triangle-alert' | 'undo-2' | 'unlink' | 'upload' | 'user' | 'user-round' | 'users' | 'video' | 'webhook' | 'wifi' | 'workflow' | 'x' | 'zap';
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; filled?: boolean; label?: string; className?: string; style?: React.CSSProperties }
export declare function Icon(props: IconProps): React.ReactElement | null;

export interface MarkProps { size?: number; tile?: boolean; label?: string; className?: string; style?: React.CSSProperties }
export declare function Mark(props: MarkProps): React.ReactElement;

export interface SpinnerProps { size?: number }
export declare function Spinner(props: SpinnerProps): React.ReactElement;

export interface KbdProps { keys?: string[]; children?: string; className?: string }
export declare function Kbd(props: KbdProps): React.ReactElement;
export interface CommandProps { cmd: string; prompt?: string; block?: boolean; label?: string; onCopy?: (cmd: string) => void; className?: string }
export declare function Command(props: CommandProps): React.ReactElement | null;

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName; kbd?: string | string[]; loading?: boolean; block?: boolean; href?: string; type?: 'button' | 'submit' | 'reset' }
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement | HTMLAnchorElement>>;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; size?: 'xs' | 'sm' | 'md'; variant?: 'ghost' | 'secondary'; active?: boolean; filled?: boolean; tone?: 'success'; href?: string }
export declare const IconButton: React.ForwardRefExoticComponent<IconButtonProps & React.RefAttributes<HTMLButtonElement | HTMLAnchorElement>>;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> { label?: string; hint?: React.ReactNode; hintTone?: 'warning' | 'danger'; icon?: IconName; trailing?: React.ReactNode; size?: 'sm' | 'md' | 'lg'; invalid?: boolean }
export declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;

export interface PasswordInputProps { value?: string; defaultValue?: string; onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void; onSubmit?: (value: string) => void; submitHref?: string; placeholder?: string; label?: string; invalid?: boolean; error?: string | null; hint?: string; busy?: boolean; autoFocus?: boolean; shakeKey?: unknown; id?: string; className?: string; style?: React.CSSProperties }
export declare function PasswordInput(props: PasswordInputProps): React.ReactElement;

export interface SearchFieldProps extends Omit<InputProps, 'onChange' | 'icon' | 'trailing'> { value?: string; defaultValue?: string; onChange?: (value: string) => void; shortcut?: string[] | null }
export declare const SearchField: React.ForwardRefExoticComponent<SearchFieldProps & React.RefAttributes<HTMLInputElement>>;

export interface SwitchProps { checked?: boolean; defaultChecked?: boolean; onChange?: (checked: boolean) => void; label?: string; disabled?: boolean; id?: string }
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface SegmentOption { value: string; label: React.ReactNode; icon?: IconName }
export interface SegmentedControlProps { options: Array<string | SegmentOption>; value?: string; defaultValue?: string; onChange?: (value: string) => void; label?: string; className?: string }
export declare function SegmentedControl(props: SegmentedControlProps): React.ReactElement;

export interface BadgeProps { tone?: Tone; icon?: IconName; dot?: boolean; size?: 'sm' | 'md'; outline?: boolean; children?: React.ReactNode; className?: string }
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface ItemIconProps { name?: string; letter?: string; icon?: IconName; src?: string; size?: 'sm' | 'md' | 'lg'; solid?: boolean; className?: string; style?: React.CSSProperties }
export declare function ItemIcon(props: ItemIconProps): React.ReactElement;

export interface NavItemProps { icon?: IconName; label: React.ReactNode; count?: React.ReactNode; badge?: { tone?: Tone; text: string } | null; kbd?: string | string[]; active?: boolean; href?: string; onClick?: () => void; className?: string }
export declare function NavItem(props: NavItemProps): React.ReactElement;

export interface ItemRowProps { title: string; subtitle?: string; letter?: string; icon?: IconName; src?: string; time?: string; favorite?: boolean; alert?: 'warning' | 'danger'; mono?: boolean; active?: boolean; solid?: boolean; onClick?: () => void; href?: string; className?: string }
export declare function ItemRow(props: ItemRowProps): React.ReactElement;

export interface FieldGroupProps { children?: React.ReactNode; className?: string; style?: React.CSSProperties }
export declare function FieldGroup(props: FieldGroupProps): React.ReactElement;

export interface SecretFieldProps { label: string; icon?: IconName; value?: React.ReactNode; totp?: string; copyValue?: string; secret?: boolean; mono?: boolean; href?: string; reveal?: boolean; pinned?: boolean; copyable?: boolean; onCopy?: (label: string, value: string) => void; children?: React.ReactNode; extra?: React.ReactNode }
export declare function SecretField(props: SecretFieldProps): React.ReactElement;

export interface TotpCodeProps { secret?: string; code?: string; period?: number; digits?: number; size?: 'md' | 'lg'; onCode?: (code: string) => void; className?: string }
export declare function TotpCode(props: TotpCodeProps): React.ReactElement;

export interface StrengthMeterProps { score: 0 | 1 | 2 | 3 | 4; bits?: number; label?: string; detail?: string; className?: string }
export declare function StrengthMeter(props: StrengthMeterProps): React.ReactElement;

export interface ToastProps { title: string; description?: string | null; tone?: 'success' | 'neutral' | 'danger'; icon?: IconName; countdown?: number; onDone?: () => void; action?: React.ReactNode; className?: string; style?: React.CSSProperties }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface TooltipProps { label: React.ReactNode; kbd?: string | string[]; side?: 'top' | 'bottom' | 'left' | 'right'; delay?: number; children: React.ReactElement; className?: string }
export declare function Tooltip(props: TooltipProps): React.ReactElement;

export interface DialogProps { open?: boolean; onClose?: () => void; title?: React.ReactNode; description?: React.ReactNode; icon?: IconName; tone?: Tone; size?: 'sm' | 'md' | 'lg' | 'xl'; footer?: React.ReactNode; footerStart?: React.ReactNode; children?: React.ReactNode; layer?: 'portal' | 'contained' | 'none'; className?: string; bodyClassName?: string; autoFocus?: boolean }
export declare function Dialog(props: DialogProps): React.ReactElement | null;

export type MenuEntry = { label: React.ReactNode; icon?: IconName; hint?: string; kbd?: string | string[]; danger?: boolean; disabled?: boolean; checked?: boolean; submenu?: boolean; onSelect?: () => void } | { separator: true } | { section: string } | null | false;
export interface MenuListProps { items: MenuEntry[]; onSelect?: (item: MenuEntry) => void; label?: string; autoFocus?: boolean; className?: string; style?: React.CSSProperties }
export declare function MenuList(props: MenuListProps): React.ReactElement;
export interface MenuProps { trigger: React.ReactElement; items: MenuEntry[]; align?: 'start' | 'end'; side?: 'top' | 'bottom'; width?: number; open?: boolean; onOpenChange?: (open: boolean) => void; label?: string }
export declare function Menu(props: MenuProps): React.ReactElement;

export interface SelectOption { value: string; label: React.ReactNode }
export interface SelectProps { label?: React.ReactNode; hint?: React.ReactNode; options: Array<string | SelectOption>; value?: string; defaultValue?: string; onChange?: (value: string, event: React.ChangeEvent<HTMLSelectElement>) => void; size?: 'sm' | 'md' | 'lg'; icon?: IconName; id?: string; disabled?: boolean; ariaLabel?: string; className?: string; style?: React.CSSProperties }
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?: React.ReactNode; hint?: React.ReactNode; invalid?: boolean; mono?: boolean }
export declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;

export interface CheckboxProps { checked?: boolean; defaultChecked?: boolean; onChange?: (checked: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean; id?: string }
export declare function Checkbox(props: CheckboxProps): React.ReactElement;

export interface TabItem { value: string; label: React.ReactNode; icon?: IconName; count?: number }
export interface TabsProps { items: Array<string | TabItem>; value?: string; defaultValue?: string; onChange?: (value: string) => void; label?: string; className?: string }
export declare function Tabs(props: TabsProps): React.ReactElement;

export interface SliderProps { value?: number; defaultValue?: number; min?: number; max?: number; step?: number; onChange?: (value: number) => void; label?: string; id?: string; className?: string }
export declare function Slider(props: SliderProps): React.ReactElement;

export interface ProgressProps { value?: number; max?: number; tone?: 'success' | 'warning' | 'danger'; indeterminate?: boolean; label?: string; className?: string }
export declare function Progress(props: ProgressProps): React.ReactElement;

export interface CalloutProps { tone?: Tone; icon?: IconName; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }
export declare function Callout(props: CalloutProps): React.ReactElement;

export interface EmptyStateProps { icon?: IconName; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

export interface SettingRowProps { title: React.ReactNode; description?: React.ReactNode; icon?: IconName; danger?: boolean; htmlFor?: string; children?: React.ReactNode; className?: string }
export declare function SettingRow(props: SettingRowProps): React.ReactElement;

export interface AvatarProps { name?: string; size?: number; tone?: Tone; className?: string }
export declare function Avatar(props: AvatarProps): React.ReactElement;

export interface CommandItem { id?: string; label: string; hint?: string; icon?: IconName; tile?: { name?: string; icon?: IconName }; kbd?: string[]; keywords?: string; onSelect?: () => void }
export interface CommandGroup { label: string; items: CommandItem[]; limit?: number; idleLimit?: number }
export interface CommandMenuProps { open?: boolean; onClose?: () => void; groups: CommandGroup[]; placeholder?: string; layer?: 'portal' | 'contained' | 'none'; defaultQuery?: string }
export declare function CommandMenu(props: CommandMenuProps): React.ReactElement | null;

export interface FileDropFile { name: string; size?: number; detail?: React.ReactNode }
export interface FileDropProps { file?: FileDropFile | null; title?: React.ReactNode; hint?: React.ReactNode; icon?: IconName; busy?: boolean; disabled?: boolean; accept?: string; onChoose?: () => void; onDrop?: (file: File) => void; className?: string }
export declare function FileDrop(props: FileDropProps): React.ReactElement;

export interface StepItem { value: string; label: React.ReactNode }
export interface StepperProps { items: Array<string | StepItem>; value?: string; onChange?: (value: string) => void; label?: string; className?: string }
export declare function Stepper(props: StepperProps): React.ReactElement;

export interface StatItem { key?: string; label: React.ReactNode; value: React.ReactNode; tone?: Tone; icon?: IconName; active?: boolean; onClick?: () => void }
export interface StatGroupProps { items: StatItem[]; label?: string; className?: string }
export declare function StatGroup(props: StatGroupProps): React.ReactElement;

export interface CompareRow { key: string; label: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode; secret?: boolean; mono?: boolean; kind?: 'same' | 'changed' | 'added' | 'removed' }
export interface CompareTableProps { columns?: { left: React.ReactNode; right: React.ReactNode }; rows: CompareRow[]; revealAll?: boolean; className?: string }
export declare function CompareTable(props: CompareTableProps): React.ReactElement;

export interface ChoiceGroupProps { value?: string; onChange?: (value: string) => void; label?: string; columns?: number; children?: React.ReactNode; className?: string }
export declare function ChoiceGroup(props: ChoiceGroupProps): React.ReactElement;
export interface ChoiceTileProps { value?: string; icon?: IconName; tile?: ItemIconProps; title: React.ReactNode; description?: React.ReactNode; meta?: React.ReactNode; selected?: boolean; disabled?: boolean; onSelect?: (value?: string) => void; className?: string }
export declare function ChoiceTile(props: ChoiceTileProps): React.ReactElement;

export interface ReviewRowProps { title: string; subtitle?: React.ReactNode; name?: string; letter?: string; icon?: IconName; src?: string; solid?: boolean; checked?: boolean; onCheck?: (checked: boolean) => void; disabled?: boolean; badges?: React.ReactNode; trailing?: React.ReactNode; tone?: 'warning' | 'danger'; expanded?: boolean; onToggle?: () => void; children?: React.ReactNode; className?: string }
export declare function ReviewRow(props: ReviewRowProps): React.ReactElement;

export declare function totp(secret: string, period?: number, digits?: number, at?: number): Promise<string>;
export declare function copyText(text: string): Promise<void>;

declare global {
  interface Window {
    APM: { Icon: typeof Icon; Mark: typeof Mark; Spinner: typeof Spinner; Kbd: typeof Kbd; Command: typeof Command; Button: typeof Button; IconButton: typeof IconButton; Tooltip: typeof Tooltip; Input: typeof Input; PasswordInput: typeof PasswordInput; SearchField: typeof SearchField; Select: typeof Select; Textarea: typeof Textarea; Checkbox: typeof Checkbox; Switch: typeof Switch; SegmentedControl: typeof SegmentedControl; Tabs: typeof Tabs; Slider: typeof Slider; Badge: typeof Badge; ItemIcon: typeof ItemIcon; Avatar: typeof Avatar; NavItem: typeof NavItem; ItemRow: typeof ItemRow; FieldGroup: typeof FieldGroup; SecretField: typeof SecretField; SettingRow: typeof SettingRow; TotpCode: typeof TotpCode; StrengthMeter: typeof StrengthMeter; Progress: typeof Progress; Callout: typeof Callout; EmptyState: typeof EmptyState; Toast: typeof Toast; Dialog: typeof Dialog; Menu: typeof Menu; MenuList: typeof MenuList; CommandMenu: typeof CommandMenu; FileDrop: typeof FileDrop; Stepper: typeof Stepper; StatGroup: typeof StatGroup; CompareTable: typeof CompareTable; ChoiceGroup: typeof ChoiceGroup; ChoiceTile: typeof ChoiceTile; ReviewRow: typeof ReviewRow; icons: IconName[]; totp: typeof totp; copyText: typeof copyText };
  }
}
