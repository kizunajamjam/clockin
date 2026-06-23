'use client'
import { useActionState } from 'react'
import { updatePassword } from './actions'

export function UpdatePasswordForm() {
  const [state, action, isPending] = useActionState(updatePassword, null)

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">新しいパスワードを設定</h1>
      </div>

      <form action={action} className="space-y-4">
        {state?.error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
        )}
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">新しいパスワード（8文字以上）</label>
          <input
            id="password" name="password" type="password" required minLength={8} autoComplete="new-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <button
          type="submit" disabled={isPending}
          className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? '更新中...' : 'パスワードを更新する'}
        </button>
      </form>
    </div>
  )
}
