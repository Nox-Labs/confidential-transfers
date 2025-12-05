import axios from "axios"
import { config } from "@/config"

export const api = {
  register: async (userId: string) => {
    const response = await axios.post(`${config.apiUrl}/register`, { userId })
    return response.data
  },

  init: async (userId: string, signature: string) => {
    const response = await axios.post(`${config.apiUrl}/init`, {
      userId,
      signature,
    })
    return response.data
  },

  deposit: async (userId: string, signature: string, amount: string) => {
    const response = await axios.post(`${config.apiUrl}/deposit`, {
      userId,
      signature,
      amount,
    })
    return response.data
  },

  transfer: async (
    userId: string,
    signature: string,
    to: string,
    amount: string
  ) => {
    const response = await axios.post(`${config.apiUrl}/transfer`, {
      userId,
      signature,
      to,
      amount,
    })
    return response.data
  },

  withdraw: async (userId: string, signature: string, amount: string) => {
    const response = await axios.post(`${config.apiUrl}/withdraw`, {
      userId,
      signature,
      amount,
    })
    return response.data
  },

  apply: async (
    userId: string,
    signature: string,
    pendingTransfersIndexes: number[]
  ) => {
    const response = await axios.post(`${config.apiUrl}/apply`, {
      userId,
      signature,
      pendingTransfersIndexes,
    })
    return response.data
  },

  applyAndTransfer: async (
    userId: string,
    signature: string,
    pendingTransfersIndexes: number[],
    to: string,
    amount: string
  ) => {
    const response = await axios.post(`${config.apiUrl}/applyAndTransfer`, {
      userId,
      signature,
      pendingTransfersIndexes,
      to,
      amount,
    })
    return response.data
  },
}
