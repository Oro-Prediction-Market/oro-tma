import { themeParams, useSignal } from '@tma.js/sdk-react';
import type { FC } from 'react';
import { List } from '@telegram-apps/telegram-ui';

import { DisplayData } from '@/components/DisplayData/DisplayData';
import { Page } from '@/components/Page';

export const ThemeParamsPage: FC = () => {
  const tp = useSignal(themeParams.state);

  return (
    <Page>
      <List>
        <DisplayData
          rows={
            Object
              .entries(tp)
              .map(([title, value]) => ({
                title: title
                  .replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
                  .replace(/background/, 'bg'),
                value,
              }))
          }
        />
      </List>
    </Page>
  );
};
