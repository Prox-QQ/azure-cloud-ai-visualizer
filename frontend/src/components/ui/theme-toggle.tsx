import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Button } from './button';
import { useTheme } from 'next-themes';

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  // Ensure client-only usage (next-themes relies on client side)
  useEffect(() => {}, []);

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('white-blue');
    else if (theme === 'white-blue') setTheme('light');
    else setTheme('dark');
  };

  const icon = theme === 'dark' ? 'mdi:weather-night' : 'mdi:white-balance-sunny';

  return (
    <Button variant="ghost" size="sm" className="gap-2" onClick={cycleTheme}>
      <Icon icon={icon} />
      <span className="hidden md:inline">Theme</span>
    </Button>
  );
};

export default ThemeToggle;
