import { ShopNav } from './ShopNav'

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ shopId: string }>
}) {
  const { shopId } = await params
  return (
    <div className="pb-16">
      {children}
      <ShopNav shopId={shopId} />
    </div>
  )
}
