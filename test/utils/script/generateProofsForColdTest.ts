import {
  getProofFilenameForColdTest,
  PROOFS_DIR,
  DEPOSIT_AMOUNT,
  WITHDRAW_AMOUNT,
  TRANSFER_AMOUNT,
} from "./getProofFilenameForColdTest.js"
import { baseSetupUninitializedUsers } from "../../hardhat/BaseSetup.js"
import * as fs from "fs"
import * as path from "path"
import { ProofOutput } from "../../../packages/sdk/src/modules/types.js"
import { ConfidentialTransfersSDK } from "../../../packages/sdk/src/index.js"

const { user1, user2, sdk, token, getNonce, setAuditor } =
  await baseSetupUninitializedUsers()

async function generateAndSaveProofs() {
  if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true })

  // --- 1. Init Proof user1 ---
  {
    const { cPrivateKey } =
      await ConfidentialTransfersSDK.deriveConfidentialKeys(
        BigInt(user1.privateKey)
      )
    const initInputs = await sdk.getCircuitInputsForInit(cPrivateKey)
    const initProofOutput = await sdk.generateInitProof(initInputs)
    const filename = getProofFilenameForColdTest(
      "init",
      user1.index,
      await getNonce(user1)
    )
    saveProofToFile(filename, initProofOutput)
    const initParams = sdk.getInitParams(initProofOutput)
    await token.connect(user1).cInit(initParams)
  }

  // --- 2. Init Proof user2 ---
  {
    const { cPrivateKey } =
      await ConfidentialTransfersSDK.deriveConfidentialKeys(
        BigInt(user2.privateKey)
      )
    const initInputs = await sdk.getCircuitInputsForInit(cPrivateKey)
    const initProofOutput = await sdk.generateInitProof(initInputs)
    const filename = getProofFilenameForColdTest(
      "init",
      user2.index,
      await getNonce(user2)
    )
    saveProofToFile(filename, initProofOutput)
    const initParams = sdk.getInitParams(initProofOutput)
    await token.connect(user2).cInit(initParams)
  }

  await setAuditor(user1)

  // --- 3. Deposit Proof user1 ---
  await deposit(true)
  {
    // --- 3.1 Deposit Proof user1 ---
    await deposit(false)

    // --- 3.1 Withdraw Proof ---
    await withdraw(false)
  }

  // --- 4. Transfer Proof ---
  await transfer(true)
  {
    // --- 4.1 Apply Proof ---
    await apply(false, [0])

    // --- 4.1 Withdraw Proof ---
    await withdraw(false)

    // --- 4.1 Apply and Transfer Proof ---
    await applyAndTransfer(false, [0])
  }

  // --- 5 Transfer Proof ---
  await transfer(true)
  {
    // --- 5.1 Apply Proof ---
    await apply(false, [1])
    // --- 5.1 Apply Proof ---
    await apply(false, [0, 1])
    // --- 5.1 Apply Proof ---
    {
      const execute = false
      const indexes = [0, 0]
      const filename = getProofFilenameForColdTest(
        "apply",
        user2.index,
        await getNonce(user2),
        undefined,
        indexes
      )
      if (!isFileExists(filename) || execute) {
        const { cPrivateKey } =
          await ConfidentialTransfersSDK.deriveConfidentialKeys(
            BigInt(user2.privateKey)
          )
        const ai = await sdk.getCircuitInputsForApply(
          user2.address,
          cPrivateKey,
          indexes
        )

        ai.pendingTransfersCommitments[1] = ai.pendingTransfersCommitments[0]
        ai.pendingTransfersAmounts[1] = ai.pendingTransfersAmounts[0]
        ai.pendingTransfersBF[1] = ai.pendingTransfersBF[0]

        const applyProofOutput = await sdk.generateApplyProof(ai)
        const applyParams = sdk.getApplyParams(indexes, applyProofOutput)
        if (execute) await token.connect(user2).cApply(applyParams)
        saveProofToFile(filename, applyProofOutput)
      }
    }
    // --- 6.3 Apply and Transfer Proof ---
    await applyAndTransfer(false, [1])
    // --- 6.3 Apply and Transfer Proof ---
    await applyAndTransfer(false, [0, 1])
  }

  // --- 6. Transfer Proof ---
  await transfer(true)
  {
    // --- 6.1 Apply Proof ---
    await apply(false, [2])
    // --- 6.1. Apply Proof ---
    await apply(false, [0, 2])
    // --- 6.2 Apply Proof ---
    await apply(false, [0, 1, 2])
    // --- 6.3 Apply and Transfer Proof ---
    await applyAndTransfer(false, [2])
    // --- 6.3 Apply and Transfer Proof ---
    await applyAndTransfer(false, [0, 2])
    // --- 6.3 Apply and Transfer Proof ---
    await applyAndTransfer(false, [0, 1, 2])
  }

  // --- 7. Transfer Proof ---
  await transfer(false)

  console.log(`\nAll proofs have been generated and saved in '${PROOFS_DIR}'`)
}

async function transfer(execute: boolean) {
  const filename = getProofFilenameForColdTest(
    "transfer",
    user1.index,
    await getNonce(user1),
    TRANSFER_AMOUNT
  )

  if (isFileExists(filename) && !execute) return

  const { cPrivateKey } = await ConfidentialTransfersSDK.deriveConfidentialKeys(
    BigInt(user1.privateKey)
  )
  const transferInputs = await sdk.getCircuitInputsForTransfer(
    user1.address,
    cPrivateKey,
    user2.address,
    TRANSFER_AMOUNT
  )
  const transferProofOutput = await sdk.generateTransferProof(transferInputs)
  const transferParams = sdk.getTransferParams(
    user2.address,
    transferProofOutput
  )
  if (execute) await token.connect(user1).cTransfer(transferParams)
  saveProofToFile(filename, transferProofOutput)
}

async function deposit(execute: boolean) {
  const filename = getProofFilenameForColdTest(
    "deposit",
    user1.index,
    await getNonce(user1),
    DEPOSIT_AMOUNT
  )

  if (isFileExists(filename) && !execute) return

  const { cPrivateKey } = await ConfidentialTransfersSDK.deriveConfidentialKeys(
    BigInt(user1.privateKey)
  )
  const depositInputs = await sdk.getCircuitInputsForDeposit(
    user1.address,
    cPrivateKey,
    DEPOSIT_AMOUNT
  )
  const depositProofOutput = await sdk.generateUpdateProof(depositInputs)
  const depositParams = sdk.getDepositParams(depositProofOutput)
  if (execute) await token.connect(user1).cDeposit(depositParams)
  saveProofToFile(filename, depositProofOutput)
}

async function withdraw(execute: boolean) {
  const filename = getProofFilenameForColdTest(
    "withdraw",
    user1.index,
    await getNonce(user1),
    WITHDRAW_AMOUNT
  )

  if (isFileExists(filename) && !execute) return

  const { cPrivateKey } = await ConfidentialTransfersSDK.deriveConfidentialKeys(
    BigInt(user1.privateKey)
  )
  const withdrawInputs = await sdk.getCircuitInputsForWithdraw(
    user1.address,
    cPrivateKey,
    WITHDRAW_AMOUNT
  )
  const withdrawProofOutput = await sdk.generateUpdateProof(withdrawInputs)
  const withdrawParams = sdk.getWithdrawParams(withdrawProofOutput)
  if (execute) await token.connect(user1).cWithdraw(withdrawParams)
  saveProofToFile(filename, withdrawProofOutput)
}

async function apply(execute: boolean, indexes: number[]) {
  const filename = getProofFilenameForColdTest(
    "apply",
    user2.index,
    await getNonce(user2),
    undefined,
    indexes
  )
  if (isFileExists(filename) && !execute) return
  const { cPrivateKey } = await ConfidentialTransfersSDK.deriveConfidentialKeys(
    BigInt(user2.privateKey)
  )
  const applyInputs = await sdk.getCircuitInputsForApply(
    user2.address,
    cPrivateKey,
    indexes
  )
  const applyProofOutput = await sdk.generateApplyProof(applyInputs)
  const applyParams = sdk.getApplyParams(indexes, applyProofOutput)
  if (execute) await token.connect(user2).cApply(applyParams)
  saveProofToFile(filename, applyProofOutput)
}

async function applyAndTransfer(execute: boolean, indexes: number[]) {
  const filename = getProofFilenameForColdTest(
    "applyAndTransfer",
    user2.index,
    await getNonce(user2),
    undefined,
    indexes
  )
  if (isFileExists(filename) && !execute) return
  const { cPrivateKey } = await ConfidentialTransfersSDK.deriveConfidentialKeys(
    BigInt(user2.privateKey)
  )
  const applyAndTransferInputs = await sdk.getCircuitInputsForApplyAndTransfer(
    user2.address,
    cPrivateKey,
    indexes,
    user1.address,
    TRANSFER_AMOUNT
  )
  const applyAndTransferProofOutput = await sdk.generateApplyAndTransferProof(
    applyAndTransferInputs
  )
  const applyAndTransferParams = sdk.getApplyAndTransferParams(
    user1.address,
    indexes,
    applyAndTransferProofOutput
  )
  if (execute)
    await token.connect(user2).cApplyAndTransfer(applyAndTransferParams)
  saveProofToFile(filename, applyAndTransferProofOutput)
}

function isFileExists(filename: string) {
  return fs.existsSync(path.join(PROOFS_DIR, `${filename}.json`))
}

function saveProofToFile(filename: string, data: ProofOutput) {
  const filePath = path.join(PROOFS_DIR, `${filename}.json`)
  const jsonString = JSON.stringify(
    data,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  )
  fs.writeFileSync(filePath, jsonString)
  console.log(`- Saved ${filename}.json`)
}

generateAndSaveProofs().catch((error) => {
  console.error("An error occurred while generating proofs:", error)
  process.exit(1)
})
