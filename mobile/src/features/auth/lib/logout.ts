/**
 * ログアウト時のローカルデータ扱い（FR-019 / data-model.md §3）。
 * 端末に本人以外のデータを残さないため、確認の上で該当ユーザーの行を全削除してからサインアウトする。
 */

export interface LogoutPlan {
    /** 未転送ログがあり、消失の確認が必要か */
    requiresConfirmation: boolean;
    pendingCount: number;
}

/** ログアウト前の判定。未転送（pending + failed）が 1 件でもあれば警告する */
export const planLogout = (pendingCount: number): LogoutPlan => ({
    requiresConfirmation: pendingCount > 0,
    pendingCount,
});

interface ExecuteLogoutDeps {
    /** 該当ユーザーの pending / cached / meta を全削除する */
    deleteUserData: () => Promise<void>;
    signOut: () => Promise<void>;
}

/** データ削除 → サインアウトの順（削除に失敗したらサインアウトせず再試行可能にする） */
export const executeLogout = async ({ deleteUserData, signOut }: ExecuteLogoutDeps): Promise<void> => {
    await deleteUserData();
    await signOut();
};
