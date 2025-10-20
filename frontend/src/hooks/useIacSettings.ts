import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cloudviz_iac_settings_v1';

export type IacSettings = {
  providerVersion?: string;
  requiredProviders?: string;
  workspace?: string;
  namingConvention?: string;
  variables?: string;
  remoteBackend?: string;
  initAndValidate?: boolean;
};

export function useIacSettings() {
  const [settings, setSettings] = useState<IacSettings>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
  }, []);

  const save = (s: IacSettings) => {
    setSettings(s);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      // ignore
    }
  };

  return { settings, save };
}
