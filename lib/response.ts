import { NextResponse } from "next/server";
import type { ApiResponse, PaginatedData, PaginationParams } from "@/types/api";

export function ok<T>(data: T, message = "Success") {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, message, data },
    { status: 200 }
  );
}

export function created<T>(data: T, message = "Created successfully") {
  return NextResponse.json<ApiResponse<T>>(
    { success: true, message, data },
    { status: 201 }
  );
}

export function err(
  message: string,
  status = 400,
  errors?: Record<string, string[]>
) {
  return NextResponse.json<ApiResponse>(
    { success: false, message, ...(errors && { errors }) },
    { status }
  );
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
  message = "Success"
) {
  const data: PaginatedData<T> = {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
  return NextResponse.json<ApiResponse<PaginatedData<T>>>(
    { success: true, message, data },
    { status: 200 }
  );
}

export function parsePagination(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20"));
  const search = url.searchParams.get("search") ?? undefined;
  return { page, limit, skip: (page - 1) * limit, search };
}
