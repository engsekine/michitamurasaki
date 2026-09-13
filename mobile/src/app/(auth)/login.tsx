import { Redirect } from 'expo-router';

import { LoginForm } from '../../features/auth/components/LoginForm';
import { useSession } from '../../features/auth/useSession';

/** ログイン画面（FR-018）。ログイン済みならログ一覧へ */
export default function LoginScreen() {
    const { session, isLoading } = useSession();

    if (isLoading) return null;
    if (session) return <Redirect href="/" />;

    return <LoginForm />;
}
