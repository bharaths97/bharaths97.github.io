import { TerminalTopBar } from '../layout/TerminalTopBar';

interface ChatTopBarProps {
  username: string;
  isAdmin: boolean;
  onControlCenter: () => void;
  onLogout: () => void;
}

export function ChatTopBar({ username, isAdmin, onControlCenter, onLogout }: ChatTopBarProps) {
  return (
    <TerminalTopBar
      leftLabel="the_manuscript.init"
      items={[
        ...(isAdmin
          ? [
              {
                id: 'control-center',
                label: 'control_center',
                onClick: onControlCenter
              }
            ]
          : []),
        {
          id: 'username',
          label: username
        },
        {
          id: 'logout',
          label: 'logout',
          onClick: onLogout
        }
      ]}
    />
  );
}
