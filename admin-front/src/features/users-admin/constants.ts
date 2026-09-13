/**
 * users-admin の定数。
 * Server Action ファイル（'use server'）は async 関数以外を export できないため、
 * アクションとテストで共有するメッセージはここに置く。
 */

/** 2 要素認証の解除を superadmin 以外が実行したときのエラー */
export const MFA_REMOVE_SUPERADMIN_ONLY_MESSAGE = '2 要素認証の解除は上位管理者のみ実行できます';
