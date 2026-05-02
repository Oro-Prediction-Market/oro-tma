import React from 'react';
import { Page } from './Page';

export const TmaPageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Page back={true}>
      {children}
    </Page>
  );
};
