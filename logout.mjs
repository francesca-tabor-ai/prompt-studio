import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://wimzhjycbbgriqgnejas.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbXpoanljYmJncmlxZ25lamFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTkzMTgsImV4cCI6MjA3OTk5NTMxOH0.wNYHLZeANuMr1DLXjR-O0iA1t7ZdDkhOo9ewR6BWbks'
);

(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
      console.log('Current user:', session.user.email);
      console.log('Logging out...');

      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout error:', error.message);
      } else {
        console.log('✓ Successfully logged out!');
        console.log('\nYou can now try logging back in.');
      }
    } else {
      console.log('No active session found - already logged out');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
