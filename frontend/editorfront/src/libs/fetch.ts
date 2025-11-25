import type { ApiError } from '../types/API'

export class FetchError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'FetchError'
  }
}

const defaultFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error: ApiError = {
      message: response.statusText || 'An error occurred',
      status: response.status,
    }
    throw new FetchError(error.message, error.status)
  }

  return response.json()
}

export default defaultFetch
