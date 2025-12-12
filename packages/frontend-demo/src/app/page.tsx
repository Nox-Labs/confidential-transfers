"use client"

import { useWallet } from "@/hooks/useWallet"
import { api } from "@/services/api"
import { useState, useEffect } from "react"
import { ethers } from "ethers"
import {
  ConfidentialTransfers,
  SDK,
  ERC20,
  cInitParams,
  confidentialTransfersAbi,
  Account,
} from "@noxlabs/confidential-transfers-sdk"
import { config } from "@/config"

const ERC20_INTERFACE = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
]

const MOCK_ERC20_INTERFACE = [
  ...ERC20_INTERFACE,
  "function mint(address account, uint256 amount) external",
]

export default function Home() {
  const { address, isConnected, connect, signer } = useWallet()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>("")
  const [signature, setSignature] = useState<string | null>(null)
  const [entropy, setEntropy] = useState<string | null>(null)
  const [contract, setContract] = useState<
    (ConfidentialTransfers & ERC20) | null
  >(null)

  // State
  const [accountState, setAccountState] = useState<any>(null)
  const [decryptedState, setDecryptedState] = useState<any>(null)
  const [publicBalance, setPublicBalance] = useState<string>("0")
  const [totalSupply, setTotalSupply] = useState<string>("0")
  const [contractBalance, setContractBalance] = useState<string>("0")
  const [mintAmount, setMintAmount] = useState("1000")
  const [approveAmount, setApproveAmount] = useState("1000")
  const [selectedPendingIndexes, setSelectedPendingIndexes] = useState<
    number[]
  >([])

  // Inputs
  const [depositAmount, setDepositAmount] = useState("100")
  const [transferAmount, setTransferAmount] = useState("10")
  const [withdrawAmount, setWithdrawAmount] = useState("1")
  const [transferTo, setTransferTo] = useState("")
  const [applyAndTransferAmount, setApplyAndTransferAmount] = useState("10")
  const [applyAndTransferTo, setApplyAndTransferTo] = useState("")

  useEffect(() => {
    if (signer) {
      setContract(
        new ethers.Contract(
          config.contractAddress,
          [...confidentialTransfersAbi, ...MOCK_ERC20_INTERFACE],
          signer
        ) as unknown as ConfidentialTransfers & ERC20
      )
    }
  }, [signer])

  useEffect(() => {
    if (address && contract) {
      fetchAccountState()
      fetchBalances()
      const interval = setInterval(() => {
        fetchAccountState()
        fetchBalances()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [address, contract, signature])

  const fetchAccountState = async () => {
    if (!contract || !address) return
    try {
      const data = await contract.getAccount(address)

      // Format BigInts to strings
      const format = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(format)
        if (typeof obj === "object" && obj !== null) {
          const newObj: any = {}
          for (const key in obj) {
            if (isNaN(Number(key))) {
              newObj[key] =
                typeof obj[key] === "bigint"
                  ? obj[key].toString()
                  : format(obj[key])
            }
          }
          return newObj
        }
        return obj
      }

      // Extract all state fields
      const state = {
        nonce: data.state.nonce.toString(),
        pubKey_X: data.pubKey_X.toString(),
        pubKey_Y: data.pubKey_Y.toString(),
        commitment: data.state.commitment.toString(),
        eAmount: data.state.eAmount.toString(),
      }

      // Format audit reports
      const auditReports = data.auditReports.map((ar: any) => ({
        auditor: ar.auditor,
        encryptedOTK: ar.encryptedOTK.toString(),
      }))

      // Format pending transfers
      const pendingTransfers = data.pendingTransfers.map((pt: any) => ({
        sender: pt.sender,
        nonce: pt.package.nonce.toString(),
        commitment: pt.package.commitment.toString(),
        eAmount: pt.package.eAmount.toString(),
        auditReports: pt.auditReports.map((ar: any) => ({
          auditor: ar.auditor,
          encryptedOTK: ar.encryptedOTK.toString(),
        })),
      }))

      setAccountState({
        state,
        auditReports,
        pendingTransfers,
        pendingCount: pendingTransfers.length,
      })

      // Clear selected indexes if they no longer exist
      setSelectedPendingIndexes((prev) =>
        prev.filter((idx) => idx < pendingTransfers.length)
      )

      // Decrypt if we have signature
      if (signature) {
        await decryptAccountData(data, signature)
      }
    } catch (e) {
      console.error("Error fetching state:", e)
    }
  }

  const fetchBalances = async () => {
    if (!contract || !address) return
    try {
      // Public balance of user
      const userBalance = await contract.balanceOf(address)
      setPublicBalance((userBalance / BigInt(10 ** 18)).toString())

      // Total supply
      const supply = await contract.totalSupply()
      setTotalSupply((supply / BigInt(10 ** 18)).toString())

      // Contract balance (tokens in confidential layer)
      const contractBal = await contract.balanceOf(config.contractAddress)
      setContractBalance((contractBal / BigInt(10 ** 18)).toString())
    } catch (e) {
      console.error("Error fetching balances:", e)
    }
  }

  const handleMint = async () => {
    if (!address || !contract) return
    try {
      setLoading(true)
      setStatus("Minting tokens...")
      const tx = await contract.mint(
        address,
        BigInt(mintAmount) * BigInt(10 ** 18)
      )
      await tx.wait()
      setStatus("Tokens minted!")
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!address || !contract) return
    try {
      setLoading(true)
      setStatus("Approving tokens...")
      const tx = await contract.approve(
        config.contractAddress,
        BigInt(approveAmount) * BigInt(10 ** 18)
      )
      await tx.wait()
      setStatus("Tokens approved!")
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const decryptAccountData = async (accountData: Account, sig: string) => {
    try {
      // Derive cPrivateKey from signature (same as backend)
      // Backend uses BigInt(signature) directly, so we need to convert hex string to BigInt
      const entropyForKeys = BigInt(sig)
      const keys = await SDK.deriveConfidentialKeys(entropyForKeys)

      const decrypted: any = {
        state: {
          ...accountData.state,
          nonce: accountData.state.nonce.toString(),
          pubKey_X: accountData.pubKey_X.toString(),
          pubKey_Y: accountData.pubKey_Y.toString(),
          commitment: accountData.state.commitment.toString(),
          eAmount: accountData.state.eAmount.toString(),
        },
        pendingTransfers: [],
      }

      // Decrypt state amount
      if (BigInt(accountData.state.commitment) !== BigInt(0)) {
        try {
          const amount = await SDK.decryptAmount(
            keys.cPrivateKey,
            BigInt(accountData.state.nonce),
            BigInt(accountData.state.eAmount)
          )
          const otk = await SDK.generateOTK(
            keys.cPrivateKey,
            BigInt(accountData.state.nonce)
          )
          const commitment = await SDK.generateCommitment(amount, otk)

          decrypted.state.decryptedAmount = (
            amount / BigInt(10 ** 18)
          ).toString()
          decrypted.state.otk = otk.toString()
          decrypted.state.calculatedCommitment = commitment.toString()
          decrypted.state.commitmentMatches =
            commitment.toString() === accountData.state.commitment.toString()
        } catch (e) {
          console.error("Failed to decrypt state:", e)
        }
      }

      const { pubKey_Xs, pubKey_Ys } = await contract!.getCPublicKeys(
        accountData.pendingTransfers.map((pt: any) => pt.sender)
      )

      // Decrypt pending transfers
      for (let i = 0; i < accountData.pendingTransfers.length; i++) {
        const pt = accountData.pendingTransfers[i]
        try {
          // Derive shared key with sender
          const sharedKey = await SDK.deriveSharedKey(
            keys.cPrivateKey,
            BigInt(pubKey_Xs[i]),
            BigInt(pubKey_Ys[i])
          )
          const amount = await SDK.decryptAmount(
            sharedKey,
            BigInt(pt.payload.nonce),
            BigInt(pt.payload.eAmount)
          )
          const otk = await SDK.generateOTK(sharedKey, BigInt(pt.payload.nonce))
          const commitment = await SDK.generateCommitment(amount, otk)

          decrypted.pendingTransfers.push({
            index: i,
            nonce: pt.payload.nonce.toString(),
            pubKey_X: pubKey_Xs[i].toString(),
            pubKey_Y: pubKey_Ys[i].toString(),
            commitment: pt.payload.commitment.toString(),
            eAmount: pt.payload.eAmount.toString(),
            decryptedAmount: (amount / BigInt(10 ** 18)).toString(),
            otk: otk.toString(),
            calculatedCommitment: commitment.toString(),
            commitmentMatches:
              commitment.toString() === pt.payload.commitment.toString(),
          })
        } catch (e) {
          console.error(`Failed to decrypt pending transfer ${i}:`, e)
          decrypted.pendingTransfers.push({
            index: i,
            nonce: pt.payload.nonce.toString(),
            pubKey_X: pubKey_Xs[i].toString(),
            pubKey_Y: pubKey_Ys[i].toString(),
            commitment: pt.payload.commitment.toString(),
            eAmount: pt.payload.eAmount.toString(),
            error: "Failed to decrypt",
          })
        }
      }

      // Add keys info
      decrypted.keys = {
        cPrivateKey: keys.cPrivateKey.toString(),
        cPublicKey_X: keys.cPublicKey_X.toString(),
        cPublicKey_Y: keys.cPublicKey_Y.toString(),
      }

      setDecryptedState(decrypted)
    } catch (e) {
      console.error("Error decrypting account data:", e)
    }
  }

  const handleRegister = async () => {
    if (!address || !signer) return
    try {
      setLoading(true)
      setStatus("Registering...")
      const regRes = await api.register(address)
      const ent = regRes.entropy
      setEntropy(ent)

      setStatus("Signing entropy...")
      const sig = await signer.signMessage(ethers.getBytes(ent))
      setSignature(sig)
      setStatus("Authenticated!")

      // Refresh to decrypt
      if (contract) {
        const data = await contract.getAccount(address)
        await decryptAccountData(data, sig)
      }
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleInit = async () => {
    if (!address || !signature || !contract) return
    try {
      setLoading(true)

      // Check if account is already initialized
      const accountData = await contract.getAccount(address)
      if (BigInt(accountData.state.commitment) !== BigInt(0)) {
        setStatus("Error: Account already initialized!")
        return
      }

      setStatus("Generating Init Proof...")
      const params = (await api.init(address, signature)) as cInitParams

      if (!params || !params.artifacts) {
        setStatus("Error: Failed to generate proof parameters")
        return
      }

      // Log params for debugging (remove in production)
      console.log("Init params:", {
        proofLength: params.artifacts.proof?.length,
        outputsLength: params.artifacts.outputs?.length,
        outputs: params.artifacts.outputs?.map((o: any) => o.toString()),
      })

      setStatus("Sending Init Transaction...")

      // Estimate gas first to catch errors early
      try {
        const gasEstimate = await contract.cInit.estimateGas(params)
        console.log("Gas estimate:", gasEstimate.toString())
      } catch (estimateError: any) {
        console.error("Gas estimation failed:", estimateError)
        throw estimateError
      }

      const tx = await contract.cInit(params)
      const receipt = await tx.wait()

      if (!receipt || receipt.status === 0) {
        setStatus("Error: Transaction failed")
        return
      }

      setStatus("Account Initialized!")
      const data = await contract.getAccount(address)
      await decryptAccountData(data, signature)
      await fetchAccountState()
      await fetchBalances()
    } catch (e: any) {
      console.error("Init error:", e)
      let errorMsg = e.message || "Unknown error"

      // Check for specific revert reasons
      if (e.reason) {
        errorMsg = e.reason
      } else if (e.data?.message) {
        errorMsg = e.data.message
      } else if (typeof e === "string") {
        errorMsg = e
      }

      // Check if account already initialized
      if (
        errorMsg.includes("AccountAlreadyInitialized") ||
        errorMsg.includes("already initialized")
      ) {
        errorMsg = "Account already initialized"
      } else if (
        errorMsg.includes("ProofVerificationFailed") ||
        errorMsg.includes("proof")
      ) {
        errorMsg = "Proof verification failed - check backend logs"
      }

      setStatus(`Error: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeposit = async () => {
    if (!address || !signature || !contract) return
    try {
      setLoading(true)
      setStatus("Generating Deposit Proof...")
      const params = await api.deposit(
        address,
        signature,
        (BigInt(depositAmount) * BigInt(10 ** 18)).toString()
      )

      setStatus("Sending Deposit Transaction...")
      const tx = await contract.cDeposit(params)
      await tx.wait()
      setStatus("Deposited!")
      const data = await contract.getAccount(address)
      await decryptAccountData(data, signature)
      await fetchAccountState()
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!address || !signature || !contract) return
    try {
      setLoading(true)
      setStatus("Generating Transfer Proof...")
      const params = await api.transfer(
        address,
        signature,
        transferTo,
        (BigInt(transferAmount) * BigInt(10 ** 18)).toString()
      )

      setStatus("Sending Transfer Transaction...")
      const tx = await contract.cTransfer(params)
      await tx.wait()
      setStatus("Transferred!")
      const data = await contract.getAccount(address)
      await decryptAccountData(data, signature)
      await fetchAccountState()
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async () => {
    if (!address || !signature || !contract) return
    try {
      setLoading(true)
      setStatus("Generating Withdraw Proof...")
      const params = await api.withdraw(
        address,
        signature,
        (BigInt(withdrawAmount) * BigInt(10 ** 18)).toString()
      )

      setStatus("Sending Withdraw Transaction...")
      const tx = await contract.cWithdraw(params)
      await tx.wait()
      setStatus("Withdrawn!")
      const data = await contract.getAccount(address)
      await decryptAccountData(data, signature)
      await fetchAccountState()
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!address || !signature || !contract) return

    // Use selected indexes or all if none selected
    const indexesToApply =
      selectedPendingIndexes.length > 0
        ? selectedPendingIndexes
        : accountState?.pendingTransfers.map((_: any, idx: number) => idx) || []

    if (indexesToApply.length === 0) {
      setStatus("No pending transfers to apply")
      return
    }

    try {
      setLoading(true)
      setStatus("Generating Apply Proof...")
      const params = await api.apply(address, signature, indexesToApply)

      if (params.message) {
        setStatus(params.message)
        return
      }

      setStatus("Sending Apply Transaction...")
      const tx = await contract.cApply(params)
      await tx.wait()
      setStatus("Applied Pending Transfers!")
      setSelectedPendingIndexes([]) // Clear selection after apply
      const data = await contract.getAccount(address)
      await decryptAccountData(data, signature)
      await fetchAccountState()
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyAndTransfer = async () => {
    if (!address || !signature || !contract) return

    if (!applyAndTransferTo) {
      setStatus("Please enter recipient address")
      return
    }

    // Use selected indexes or all if none selected
    const indexesToApply =
      selectedPendingIndexes.length > 0
        ? selectedPendingIndexes
        : accountState?.pendingTransfers.map((_: any, idx: number) => idx) || []

    if (indexesToApply.length === 0) {
      setStatus("No pending transfers to apply")
      return
    }

    try {
      setLoading(true)
      setStatus("Generating ApplyAndTransfer Proof...")
      const params = await api.applyAndTransfer(
        address,
        signature,
        indexesToApply,
        applyAndTransferTo,
        (BigInt(applyAndTransferAmount) * BigInt(10 ** 18)).toString()
      )

      if (params.message) {
        setStatus(params.message)
        return
      }

      setStatus("Sending ApplyAndTransfer Transaction...")
      const tx = await contract.cApplyAndTransfer(params)
      await tx.wait()
      setStatus("Applied Pending Transfers and Transferred!")
      setSelectedPendingIndexes([]) // Clear selection after apply
      setApplyAndTransferTo("") // Clear recipient
      setApplyAndTransferAmount("10") // Reset amount
      const data = await contract.getAccount(address)
      await decryptAccountData(data, signature)
      await fetchAccountState()
      await fetchBalances()
    } catch (e: any) {
      console.error(e)
      setStatus(`Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-900 text-white">
      <div className="z-10 w-full items-center justify-between font-mono text-sm flex mb-6">
        <p className="text-xl font-bold">Confidential Transfers Demo</p>
        <div>
          {!isConnected ? (
            <button
              onClick={connect}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Connect Wallet
            </button>
          ) : (
            <span className="bg-gray-800 px-3 py-1 rounded border border-gray-700">
              {address}
            </span>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 text-center mb-6">
        <h2 className="text-lg font-bold mb-2">Status</h2>
        <p className="text-yellow-400 h-6">{status}</p>
      </div>

      {isConnected && (
        <>
          {!signature ? (
            <div className="flex justify-center">
              <button
                onClick={handleRegister}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 py-4 px-8 rounded-xl font-bold text-lg"
              >
                Authenticate (Sign Message)
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Balances & Mint */}
              <div className="space-y-4">
                {/* Balances */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="text-lg font-bold mb-4 border-b border-gray-600 pb-2">
                    Token Balances
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="text-gray-500 block mb-1">
                        Your Public Balance:
                      </span>
                      <div className="font-mono text-green-400 text-lg font-bold">
                        {publicBalance}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">
                        Total Supply:
                      </span>
                      <div className="font-mono text-blue-400 text-lg font-bold">
                        {totalSupply}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500 block mb-1">
                        Contract Balance (Confidential):
                      </span>
                      <div className="font-mono text-purple-400 text-lg font-bold">
                        {contractBalance}
                      </div>
                    </div>
                    {decryptedState?.state?.decryptedAmount && (
                      <div>
                        <span className="text-gray-500 block mb-1">
                          Your Confidential Balance:
                        </span>
                        <div className="font-mono text-cyan-400 text-lg font-bold">
                          {decryptedState.state.decryptedAmount}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mint */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="font-bold mb-4">Mint Tokens</h3>
                  <input
                    type="number"
                    value={mintAmount}
                    onChange={(e) => setMintAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white"
                    placeholder="Amount"
                  />
                  <button
                    onClick={handleMint}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-bold"
                  >
                    Mint
                  </button>
                </div>
              </div>
              {/* Middle Column: Account State */}
              <div className="lg:col-span-1">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 h-full overflow-y-auto max-h-[calc(100vh-250px)]">
                  <h3 className="text-lg font-bold mb-4 border-b border-gray-600 pb-2">
                    Account State
                  </h3>
                  {accountState ? (
                    <div className="space-y-3 text-xs">
                      {/* State Info */}
                      <div className="space-y-2">
                        <h4 className="font-semibold text-blue-400 text-sm">
                          State
                        </h4>
                        <div className="grid grid-cols-1 gap-1">
                          <div>
                            <span className="text-gray-500">Nonce:</span>
                            <div className="font-mono text-green-400">
                              {accountState.state.nonce}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Commitment:</span>
                            <div className="font-mono text-gray-300 break-all bg-gray-900 p-1 rounded text-xs">
                              {accountState.state.commitment}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">
                              Encrypted Amount:
                            </span>
                            <div className="font-mono text-yellow-400 break-all bg-gray-900 p-1 rounded text-xs">
                              {accountState.state.eAmount}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">
                              Audit Reports:
                            </span>
                            {accountState.auditReports?.length > 0 ? (
                              <div className="space-y-1 mt-1">
                                {accountState.auditReports.map(
                                  (ar: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="bg-gray-900 p-1 rounded text-[10px] border border-gray-700"
                                    >
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">
                                          Aud:
                                        </span>
                                        <span className="font-mono text-gray-300">
                                          {ar.auditor.slice(0, 6)}...
                                        </span>
                                      </div>
                                      <div
                                        className="font-mono text-purple-400 truncate"
                                        title={ar.encryptedOTK}
                                      >
                                        {ar.encryptedOTK.slice(0, 10)}...
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="font-mono text-gray-500 text-xs">
                                None
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Decrypted Info */}
                      {decryptedState?.state && (
                        <div className="space-y-2 pt-3 border-t border-gray-700">
                          <h4 className="font-semibold text-green-400 text-sm">
                            Decrypted
                          </h4>
                          <div>
                            <span className="text-gray-500">Amount:</span>
                            <div className="font-mono text-green-400 text-base font-bold">
                              {decryptedState.state.decryptedAmount || "N/A"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Valid:</span>
                            <div
                              className={`font-mono ${
                                decryptedState.state.commitmentMatches
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {decryptedState.state.commitmentMatches
                                ? "✓"
                                : "✗"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1 text-xs">
                              Blinding Factor:
                            </span>
                            <div className="font-mono text-purple-400 text-xs break-all bg-gray-900 p-1 rounded">
                              {decryptedState.state.blindingFactor}
                            </div>
                            <div className="text-xs text-gray-400 italic mt-1">
                              BF = Poseidon(cPrivateKey, nonce)
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1 text-xs">
                              Calculated Commitment:
                            </span>
                            <div className="font-mono text-cyan-400 text-xs break-all bg-gray-900 p-1 rounded">
                              {decryptedState.state.calculatedCommitment}
                            </div>
                            <div className="text-xs text-gray-400 italic mt-1">
                              Commitment = Poseidon(amount, blindingFactor)
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pending Transfers */}
                      <div className="space-y-2 pt-3 border-t border-gray-700">
                        <h4 className="font-semibold text-orange-400 text-sm">
                          Pending ({accountState.pendingCount})
                        </h4>
                        {accountState.pendingTransfers.length === 0 ? (
                          <p className="text-gray-500 text-xs">None</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {accountState.pendingTransfers.map(
                              (pt: any, idx: number) => {
                                const decrypted =
                                  decryptedState?.pendingTransfers?.find(
                                    (d: any) => d.index === idx
                                  )
                                const isSelected =
                                  selectedPendingIndexes.includes(idx)
                                return (
                                  <div
                                    key={idx}
                                    className={`bg-gray-900 p-2 rounded border ${
                                      isSelected
                                        ? "border-green-500 bg-gray-800"
                                        : "border-gray-700"
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedPendingIndexes([
                                                  ...selectedPendingIndexes,
                                                  idx,
                                                ])
                                              } else {
                                                setSelectedPendingIndexes(
                                                  selectedPendingIndexes.filter(
                                                    (i) => i !== idx
                                                  )
                                                )
                                              }
                                            }}
                                            className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                                          />
                                          <span className="text-gray-500 text-xs">
                                            #{idx}
                                          </span>
                                        </div>
                                        {decrypted?.decryptedAmount ? (
                                          <span className="font-mono text-green-400 font-bold text-sm">
                                            Amount: {decrypted.decryptedAmount}
                                          </span>
                                        ) : (
                                          <span className="text-gray-500 text-xs">
                                            (encrypted)
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs">
                                        <span className="text-gray-500">
                                          From:{" "}
                                        </span>
                                        <span className="font-mono text-blue-400">
                                          {pt.sender.slice(0, 6)}...
                                          {pt.sender.slice(-4)}
                                        </span>
                                      </div>
                                      <div className="text-xs">
                                        <span className="text-gray-500">
                                          Nonce:{" "}
                                        </span>
                                        <span className="font-mono text-gray-300">
                                          {pt.nonce}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              }
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Loading state...</p>
                  )}
                </div>
              </div>
              {/* Right Column: Actions */}
              <div className="space-y-4">
                {/* Init */}
                {BigInt(accountState?.state?.commitment ?? 0n) == BigInt(0) && (
                  <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                    <h3 className="font-bold mb-3 text-sm">Initialize</h3>
                    <button
                      onClick={handleInit}
                      disabled={loading}
                      className="w-full bg-orange-600 hover:bg-orange-700 py-2 rounded font-bold text-sm"
                    >
                      Initialize
                    </button>
                  </div>
                )}

                {/* Deposit */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="font-bold mb-3 text-sm">Deposit</h3>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white text-sm"
                    placeholder="Amount"
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-bold text-sm"
                  >
                    Deposit
                  </button>
                </div>

                {/* Transfer */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="font-bold mb-3 text-sm">Transfer</h3>
                  <input
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white text-sm"
                    placeholder="Recipient (0x...)"
                  />
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white text-sm"
                    placeholder="Amount"
                  />
                  <button
                    onClick={handleTransfer}
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 py-2 rounded font-bold text-sm"
                  >
                    Transfer
                  </button>
                </div>

                {/* Withdraw */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="font-bold mb-3 text-sm">Withdraw</h3>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white text-sm"
                    placeholder="Amount"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={loading}
                    className="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-bold text-sm"
                  >
                    Withdraw
                  </button>
                </div>

                {/* Apply */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="font-bold mb-3 text-sm">Apply Pending</h3>
                  <div className="mb-2 text-xs text-gray-400">
                    {selectedPendingIndexes.length > 0
                      ? `Selected: ${selectedPendingIndexes.length}`
                      : "Will apply all"}
                  </div>
                  <button
                    onClick={handleApply}
                    disabled={
                      loading || (accountState?.pendingCount || 0) === 0
                    }
                    className="w-full bg-teal-600 hover:bg-teal-700 py-2 rounded font-bold text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                </div>

                {/* Apply And Transfer */}
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <h3 className="font-bold mb-3 text-sm">Apply & Transfer</h3>
                  <div className="mb-2 text-xs text-gray-400">
                    {selectedPendingIndexes.length > 0
                      ? `Selected: ${selectedPendingIndexes.length}`
                      : "Will apply all"}
                  </div>
                  <input
                    value={applyAndTransferTo}
                    onChange={(e) => setApplyAndTransferTo(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white text-sm"
                    placeholder="Recipient (0x...)"
                  />
                  <input
                    type="number"
                    value={applyAndTransferAmount}
                    onChange={(e) => setApplyAndTransferAmount(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 mb-2 text-white text-sm"
                    placeholder="Amount"
                  />
                  <button
                    onClick={handleApplyAndTransfer}
                    disabled={
                      loading ||
                      (accountState?.pendingCount || 0) === 0 ||
                      !applyAndTransferTo
                    }
                    className="w-full bg-cyan-600 hover:bg-cyan-700 py-2 rounded font-bold text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    Apply & Transfer
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  )
}
