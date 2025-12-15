import axios from "axios"
import { config } from "@/config"

export const api = {
  register: async (userId: string) => {
    const response = await axios.post(`${config.apiUrl}/register`, { userId })
    return response.data
  },

  init: async (userId: string, signature: string, auditors?: string[]) => {
    const response = await axios.post(`${config.apiUrl}/init`, {
      userId,
      signature,
      auditors,
    })
    return response.data
  },

  deposit: async (
    userId: string,
    signature: string,
    amount: string,
    auditors?: string[]
  ) => {
    const response = await axios.post(`${config.apiUrl}/deposit`, {
      userId,
      signature,
      amount,
      auditors,
    })
    return response.data
  },

  transfer: async (
    userId: string,
    signature: string,
    to: string,
    amount: string,
    auditors?: string[]
  ) => {
    const response = await axios.post(`${config.apiUrl}/transfer`, {
      userId,
      signature,
      to,
      amount,
      auditors,
    })
    return response.data
  },

  withdraw: async (
    userId: string,
    signature: string,
    amount: string,
    auditors?: string[]
  ) => {
    const response = await axios.post(`${config.apiUrl}/withdraw`, {
      userId,
      signature,
      amount,
      auditors,
    })
    return response.data
  },

  apply: async (
    userId: string,
    signature: string,
    pendingTransfersIndexes: number[],
    auditors?: string[]
  ) => {
    const response = await axios.post(`${config.apiUrl}/apply`, {
      userId,
      signature,
      pendingTransfersIndexes,
      auditors,
    })
    return response.data
  },

  applyAndTransfer: async (
    userId: string,
    signature: string,
    pendingTransfersIndexes: number[],
    to: string,
    amount: string,
    auditors?: string[]
  ) => {
    const response = await axios.post(`${config.apiUrl}/applyAndTransfer`, {
      userId,
      signature,
      pendingTransfersIndexes,
      to,
      amount,
      auditors,
    })
    return response.data
  },
}
