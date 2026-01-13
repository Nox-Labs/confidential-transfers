import * as fs from "fs"
import * as path from "path"
import hre from "hardhat"
import {
  getProofFilenameForColdTest,
  PROOFS_DIR,
  DEPOSIT_AMOUNT,
  WITHDRAW_AMOUNT,
  TRANSFER_AMOUNT,
  type Operation,
} from "../utils/script/getProofFilenameForColdTest.js"
import { BaseWallet } from "ethers"
import { SDK, type ProofOutput } from "@noxlabs/confidential-transfers-sdk"
import type { MockERC20Bridgeable } from "../../out/hardhat/typechain/index.js"

export const conn = await hre.network.connect()

const pk = {
  user0: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  user1: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  user2: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
}

async function setup(target: "MockERC20" | "MockERC20Bridgeable") {
  const { ethers, networkHelpers } = conn
  const INITIAL_BALANCE = ethers.parseEther("1000")

  const MOCK_PROOF_OUTPUT: ProofOutput = {
    proof: Array(24).fill(BigInt(0)),
    pubSignals: Array(8).fill(BigInt(0)),
  }

  const getVerifierPath = (name: string) =>
    `src/verifiers/${name}PlonkVerifier.sol:PlonkVerifier`

  const iv = await ethers.deployContract(getVerifierPath("Init"))
  const av = await ethers.deployContract(getVerifierPath("Apply"))
  const uv = await ethers.deployContract(getVerifierPath("Update"))
  const tv = await ethers.deployContract(getVerifierPath("Transfer"))
  const anv = await ethers.deployContract(getVerifierPath("ApplyAndTransfer"))
  const token = (await ethers.deployContract(target, [
    4,
    await iv.getAddress(),
    await av.getAddress(),
    await uv.getAddress(),
    await tv.getAddress(),
    await anv.getAddress(),
  ])) as unknown as MockERC20Bridgeable

  const userUninitialized = Object.assign(
    new ethers.Wallet(pk.user0, ethers.provider),
    {
      index: 0,
    }
  )
  const user1 = Object.assign(new ethers.Wallet(pk.user1, ethers.provider), {
    index: 1,
  })
  const user2: typeof user1 = Object.assign(
    new ethers.Wallet(pk.user2, ethers.provider),
    {
      index: 2,
    }
  )

  await networkHelpers.setBalance(
    userUninitialized.address,
    ethers.parseEther("10000")
  )
  await networkHelpers.setBalance(user1.address, ethers.parseEther("10000"))
  await networkHelpers.setBalance(user2.address, ethers.parseEther("10000"))

  await token.mint(userUninitialized.address, INITIAL_BALANCE)
  await token.mint(user1.address, INITIAL_BALANCE)
  await token.mint(user2.address, INITIAL_BALANCE)

  const sdk = new SDK(await token.getAddress(), ethers.provider as any, {
    paths: {
      helpers: fs.realpathSync("packages/sdk/src/artifacts/proofs-helpers"),
      keys: fs.realpathSync("out/zk/keys"),
    },
  })

  const cInit = async (
    _type: "hot" | "cold",
    user: typeof user1
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey)
      )
      proofOutput = await sdk.generateInitProof(
        await sdk.getCircuitInputsForInit(cPrivateKey)
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "init",
        user.index,
        await getNonce(user)
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getInitParams(proofOutput)
    await token.connect(user).cInit(params)
    return proofOutput
  }

  const cDeposit = async (
    _type: "hot" | "cold",
    user: typeof user1,
    amount: bigint
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey)
      )
      proofOutput = await sdk.generateUpdateProof(
        await sdk.getCircuitInputsForDeposit(user.address, cPrivateKey, amount)
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "deposit",
        user.index,
        await getNonce(user),
        amount
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getDepositParams(proofOutput)
    await token.connect(user).cDeposit(params)
    return proofOutput
  }

  const cWithdraw = async (
    _type: "hot" | "cold",
    user: typeof user1,
    amount: bigint
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey)
      )
      proofOutput = await sdk.generateUpdateProof(
        await sdk.getCircuitInputsForWithdraw(user.address, cPrivateKey, amount)
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "withdraw",
        user.index,
        await getNonce(user),
        amount
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getWithdrawParams(proofOutput)
    await token.connect(user).cWithdraw(params)
    return proofOutput
  }

  const cTransfer = async (
    _type: "hot" | "cold",
    user: typeof user1,
    to: string,
    amount: bigint
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey)
      )
      proofOutput = await sdk.generateTransferProof(
        await sdk.getCircuitInputsForTransfer(
          user.address,
          cPrivateKey,
          to,
          amount
        )
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "transfer",
        user.index,
        await getNonce(user),
        amount
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getTransferParams(to, proofOutput)
    await token.connect(user).cTransfer(params)
    return proofOutput
  }

  const cApply = async (
    _type: "hot" | "cold",
    user: typeof user1,
    pendingTransfersIndexes: number[]
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey)
      )
      proofOutput = await sdk.generateApplyProof(
        await sdk.getCircuitInputsForApply(
          user.address,
          cPrivateKey,
          pendingTransfersIndexes
        )
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "apply",
        user.index,
        await getNonce(user),
        undefined,
        pendingTransfersIndexes
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getApplyParams(pendingTransfersIndexes, proofOutput)
    await token.connect(user).cApply(params)
    return proofOutput
  }

  const cApplyAndTransfer = async (
    _type: "hot" | "cold",
    user: typeof user1,
    pendingTransfersIndexes: number[],
    to: string,
    amount: bigint
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey)
      )
      proofOutput = await sdk.generateApplyAndTransferProof(
        await sdk.getCircuitInputsForApplyAndTransfer(
          user.address,
          cPrivateKey,
          pendingTransfersIndexes,
          to,
          amount
        )
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "applyAndTransfer",
        user.index,
        await getNonce(user),
        undefined,
        pendingTransfersIndexes
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getApplyAndTransferParams(
      to,
      pendingTransfersIndexes,
      proofOutput
    )
    await token.connect(user).cApplyAndTransfer(params)
    return proofOutput
  }

  const getNonce = async (user: BaseWallet) => {
    return (await token.getAccount(user.address)).state.nonce
  }

  const getProofOutput = (filename: string): ProofOutput => {
    const filePath = path.join(PROOFS_DIR, `${filename}.json`)
    const jsonString = fs.readFileSync(filePath, "utf8")
    return JSON.parse(jsonString)
  }

  const getFilename = (
    operation: Operation,
    user: number,
    nonce: bigint,
    amount?: bigint,
    indexes?: number[]
  ) => {
    const filename = getProofFilenameForColdTest(
      operation,
      user,
      nonce,
      amount,
      indexes
    )
    if (!fs.existsSync(path.join(PROOFS_DIR, `${filename}.json`))) {
      throw new Error(`Proof file ${filename} not found`)
    }
    return filename
  }

  const { cPrivateKey: user1CPrivateKey } = await SDK.deriveConfidentialKeys(
    BigInt(user1.privateKey)
  )
  const { cPrivateKey: user2CPrivateKey } = await SDK.deriveConfidentialKeys(
    BigInt(user2.privateKey)
  )

  return {
    conn,
    token,
    userUninitialized,
    user1,
    user2,
    user1CPrivateKey,
    user2CPrivateKey,
    updateVerifier: uv,
    transferVerifier: tv,
    initVerifier: iv,
    applyVerifier: av,
    sdk,
    INITIAL_BALANCE,
    PROOFS_DIR,
    DEPOSIT_AMOUNT,
    WITHDRAW_AMOUNT,
    TRANSFER_AMOUNT,
    MOCK_PROOF_OUTPUT,
    SDK,
    cInit,
    cDeposit,
    cWithdraw,
    cTransfer,
    cApply,
    cApplyAndTransfer,
    getFilename,
    getNonce,
    getProofOutput,
  }
}

async function initialize(s: Awaited<ReturnType<typeof setup>>) {
  try {
    await s.cInit("cold", s.user1)
  } catch (error) {
    await s.cInit("hot", s.user1)
  }

  try {
    await s.cInit("cold", s.user2)
  } catch (error) {
    await s.cInit("hot", s.user2)
  }

  return s
}

export async function baseSetupUninitializedUsers() {
  return setup("MockERC20")
}

export async function baseSetupUninitializedUsersBridgeable() {
  return setup("MockERC20Bridgeable")
}

export async function baseSetup() {
  return initialize(await baseSetupUninitializedUsers())
}

export async function baseSetupBridgeable() {
  return initialize(await baseSetupUninitializedUsersBridgeable())
}
