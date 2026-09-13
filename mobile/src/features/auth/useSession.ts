import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase/client';

interface SessionState {
    session: Session | null;
    /** SecureStore からの復元が終わるまで true（この間はリダイレクトしない） */
    isLoading: boolean;
}

/**
 * Supabase セッションの購読（FR-018）。
 * 圏外でも SecureStore に保存済みのセッションが復元されるため、
 * オフライン起動時も前回のユーザーとしてローカル機能を利用できる。
 */
export const useSession = (): SessionState => {
    const [state, setState] = useState<SessionState>({ session: null, isLoading: true });

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setState({ session: data.session, isLoading: false });
        });
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setState({ session, isLoading: false });
        });
        return () => subscription.unsubscribe();
    }, []);

    return state;
};
