import { Redirect } from 'expo-router';

/**
 * The bank sends the user back to this route after they approve access.
 *
 * - Web: the redirect lands in a popup, which the root layout handles before any route renders.
 * - iOS: the system browser sheet catches the redirect itself, so this route is never shown.
 * - Android: the deep link can open this route on top of the connect-bank screen, which is
 *   already finishing the connection. Sending the user to Accounts shows them the result.
 */
export default function BankCallback() {
  return <Redirect href="/accounts" />;
}
