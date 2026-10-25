'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Leaf, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await login(email, password)
      if (result && !result.success) {
        setError(result.error || 'Login gagal. Periksa email dan password Anda.')
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }
  const productCode = process.env.NEXT_PUBLIC_PRODUCT_CODE

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Panel kiri: foto sawah + pesan produk */}
      <section className="relative h-64 overflow-hidden bg-neutral-900 sm:h-72 lg:h-auto">
        <Image
          src="/images/bg-sawah.jpg"
          alt=""
          fill
          priority
          quality={75}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/20"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-6 lg:space-y-4 lg:p-12">
          <h1 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-5xl">
            Smart Monitoring &amp; Precision Farming
          </h1>
          <p className="text-base font-medium text-white sm:text-lg lg:text-xl">
            Platform Digital Twin &amp; Telemetri Pertanian Cerdas
          </p>
          <p className="hidden max-w-xl text-sm leading-relaxed text-white/90 sm:block lg:text-base">
            Pantau kondisi hara tanah secara real-time, dapatkan rekomendasi agronomik berbasis AI,
            dan tingkatkan efisiensi hasil panen secara berkelanjutan.
          </p>
        </div>
      </section>

      {/* Panel kanan: form login */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm space-y-6 motion-safe:animate-fade-in">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <Leaf className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
              </div>
              {productCode && (
                <span className="text-sm font-semibold text-foreground">{productCode}</span>
              )}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-primary">Masuk</h2>
              <p className="text-sm text-muted-foreground">
                Masukkan email dan password untuk masuk
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nama@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                  className="absolute right-0 top-0 flex h-full min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            <div role="alert">
              {error && (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
