'use client'
import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from './actions'

export default function SignupPage() {
  const [state, action, isPending] = useActionState(signUp, null)

  return (
    <main className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">無料で始める</h1>
          <p className="text-sm text-gray-500">アカウントを作成してください</p>
        </div>

        <form action={action} className="space-y-4">
          {state?.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="organization_name" className="text-sm font-medium text-gray-700">
              会社名・屋号
            </label>
            <input
              id="organization_name"
              name="organization_name"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="例：カフェ〇〇"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="example@mail.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="8文字以上"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? '作成中...' : 'アカウントを作成'}
          </button>
        </form>

        <p className="text-sm text-center text-gray-500">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/login" className="text-gray-900 font-medium hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  )
}
