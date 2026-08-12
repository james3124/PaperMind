import React from 'react';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from '@/db/database';
import AppNavigator from '@/navigation/AppNavigator';

export default function App() {
  return (
    <DatabaseProvider database={database}>
      <AppNavigator />
    </DatabaseProvider>
  );
}
