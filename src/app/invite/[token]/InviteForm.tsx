'use client'
import { useActionState, useState } from 'react'
import { acceptInvite } from './actions'

export function InviteForm({ token, staffName }: { token: string; staffName: string }) {
  const [confirmed, setConfirmed] = useState(false)
  const [state, action, pending] = useActionState(acceptInvite, null)

  if (!confirmed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">{staffName}</span> さんですか？
        </p>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="w-full py-2.5 bg-gray-900 text-white font-medium rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          はい、{staffName}です
        </button>
        <p className="text-xs text-gray-400 text-center">
          違う場合はこのページを閉じて、招待してくれた方に確認してください
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
        <input
          type="email"
          name="email"
          required
          placeholder="your@email.com"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（8文字以上）</label>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-gray-900 text-white font-medium rounded-lg text-sm disabled:opacity-50 hover:bg-gray-700 transition-colors"
      >
        {pending ? '登録中...' : 'アカウントを作成'}
      </button>

      <p className="text-xs text-gray-400 text-center">
        {staffName} として打刻できるようになります
      </p>
    </form>
  )
}
