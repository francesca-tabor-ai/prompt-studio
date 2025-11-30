/*
  # Fix auth_sessions RLS Policy for Login

  1. Changes
    - Add INSERT policy for authenticated users to create their own sessions
    - This allows the login flow to complete successfully

  2. Security
    - Users can only insert sessions for themselves (auth.uid() = user_id)
    - Maintains security while allowing proper session management
*/

CREATE POLICY "Users can create own sessions"
  ON auth_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
