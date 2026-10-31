'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { APP_ROUTES } from '@/constants/routes.constants'

export default function NotificationPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new notifications page in profile
    router.replace(APP_ROUTES.MY_NOTIFICATIONS)
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-foreground-secondary">Đang chuyển hướng...</p>
      </div>
    </div>
  )
}
