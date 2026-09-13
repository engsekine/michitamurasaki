import { useRouter } from 'expo-router';

import { useSession } from '../../features/auth/useSession';
import { DiveForm } from '../../features/dives/components/DiveForm';

/** ログ作成タブ（US1）。保存後は一覧へ戻る */
export default function NewDiveScreen() {
    const router = useRouter();
    const { session } = useSession();

    if (!session) return null;

    return <DiveForm userId={session.user.id} onSaved={() => router.replace('/')} />;
}
