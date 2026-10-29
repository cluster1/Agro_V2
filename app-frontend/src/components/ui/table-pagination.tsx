'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'

export const PAGE_SIZE = 10

/** Nomor halaman dikunci ke rentang yang valid (data bisa menyusut setelah hapus atau cari). */
export const clampPage = (page: number, total: number, pageSize = PAGE_SIZE): number =>
  Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)))

interface TablePaginationProps {
  page: number
  total: number
  pageSize?: number
  onPageChange: (page: number) => void
}

/** Navigasi halaman untuk tabel; tidak tampil bila data tidak lebih dari satu halaman. */
export function TablePagination({ page, total, pageSize = PAGE_SIZE, onPageChange }: TablePaginationProps) {
  if (total <= pageSize) return null
  const pages = Math.ceil(total / pageSize)
  const current = clampPage(page, total, pageSize)
  const from = (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  return (
    <nav aria-label="Navigasi halaman" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        Menampilkan {formatNumber(from)}-{formatNumber(to)} dari {formatNumber(total)}
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)} aria-label="Halaman sebelumnya">
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
          Sebelumnya
        </Button>
        <span className="min-w-[7rem] text-center text-sm tabular-nums" aria-current="page">
          Halaman {current} dari {pages}
        </span>
        <Button type="button" variant="outline" size="sm" disabled={current >= pages} onClick={() => onPageChange(current + 1)} aria-label="Halaman berikutnya">
          Berikutnya
          <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
