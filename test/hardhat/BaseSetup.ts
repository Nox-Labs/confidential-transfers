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
import {
  SDK,
  type ConfidentialTransfers,
  type ConfidentialTransfersBridgeable,
  type ConfidentialOFT,
  type ProofOutput,
} from "@noxlabs/confidential-transfers-sdk"
import * as circomlibjs from "circomlibjs"
import { buildPoseidon } from "circomlibjs"
import assert from "assert"

export const conn = await hre.network.connect()

const pk = {
  user0: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  user1: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  user2: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
}

async function setup(
  target:
    | "ConfidentialTransfers"
    | "ConfidentialTransfersBridgeable"
    | "ConfidentialOFT",
  isMockVerifier: boolean,
) {
  const { ethers, networkHelpers } = conn
  const INITIAL_BALANCE = ethers.parseEther("1000")

  const MOCK_PROOF_OUTPUT: ProofOutput = {
    proof: Array(24).fill(BigInt(0)),
    pubSignals: Array(8).fill(BigInt(0)),
  }

  const getVerifierPath = (name: string) =>
    isMockVerifier
      ? "test/utils/mock/MockVerifier.sol:MockVerifier"
      : `src/verifiers/${name}PlonkVerifier.sol:PlonkVerifier`

  const iv = await ethers.deployContract(getVerifierPath("Init"))
  const av = await ethers.deployContract(getVerifierPath("Apply"))
  const uv = await ethers.deployContract(getVerifierPath("Update"))
  const tv = await ethers.deployContract(getVerifierPath("Transfer"))
  const anv = await ethers.deployContract(getVerifierPath("ApplyAndTransfer"))
  const cv = await ethers.deployContract(getVerifierPath("Claim"))
  const params = [
    4,
    await iv.getAddress(),
    await av.getAddress(),
    await uv.getAddress(),
    await tv.getAddress(),
    await anv.getAddress(),
  ]

  if (target !== "ConfidentialTransfers") params.push(await cv.getAddress())

  const token = (await ethers.deployContract(
    `Mock${target}`,
    params,
  )) as unknown as ConfidentialOFT &
    ConfidentialTransfersBridgeable &
    ConfidentialTransfers & {
      mint: (address: string, amount: bigint) => Promise<void>
      transfer: (to: string, amount: bigint) => Promise<boolean>
      transferFrom: (
        from: string,
        to: string,
        amount: bigint,
      ) => Promise<boolean>
      name: () => Promise<string>
      symbol: () => Promise<string>
      decimals: () => Promise<number>
      totalSupply: () => Promise<bigint>
      balanceOf: (account: string) => Promise<bigint>
      approve: (spender: string, amount: bigint) => Promise<boolean>
      allowance: (owner: string, spender: string) => Promise<bigint>
    }

  const C2Code = circomlibjs.poseidonContract.createCode(2)
  const PoseidonFactory = new ethers.ContractFactory(
    circomlibjs.poseidonContract.generateABI(2),
    C2Code,
    await ethers.provider.getSigner(),
  )

  const poseidonCircomLib = await buildPoseidon()

  const poseidonContract = await PoseidonFactory.deploy()

  const res = await (poseidonContract as any)["poseidon(uint256[2])"]([1, 2])
  const res2 = poseidonCircomLib([1, 2])
  assert.equal(res.toString(), poseidonCircomLib.F.toString(res2))

  const userUninitialized = Object.assign(
    new ethers.Wallet(pk.user0, ethers.provider),
    {
      index: 0,
    },
  )
  const user1 = Object.assign(new ethers.Wallet(pk.user1, ethers.provider), {
    index: 1,
  })
  const user2: typeof user1 = Object.assign(
    new ethers.Wallet(pk.user2, ethers.provider),
    {
      index: 2,
    },
  )

  await networkHelpers.setBalance(
    userUninitialized.address,
    ethers.parseEther("10000"),
  )
  await networkHelpers.setBalance(user1.address, ethers.parseEther("10000"))
  await networkHelpers.setBalance(user2.address, ethers.parseEther("10000"))

  await token.mint(userUninitialized.address, INITIAL_BALANCE)
  await token.mint(user1.address, INITIAL_BALANCE)
  await token.mint(user2.address, INITIAL_BALANCE)

  const sdk = new SDK(await token.getAddress(), ethers.provider as any, {
    type: target,
    paths: {
      helpers: fs.realpathSync("packages/sdk/src/artifacts/proofs-helpers"),
      keys: fs.realpathSync("out/zk/keys"),
    },
  })

  const cInit = async (
    _type: "hot" | "cold",
    user: typeof user1,
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateInitProof(
        await sdk.getCircuitInputsForInit(cPrivateKey),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "init",
        user.index,
        await getNonce(user),
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
    amount: bigint,
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateUpdateProof(
        await sdk.getCircuitInputsForDeposit(user.address, cPrivateKey, amount),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "deposit",
        user.index,
        await getNonce(user),
        amount,
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
    amount: bigint,
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateUpdateProof(
        await sdk.getCircuitInputsForWithdraw(
          user.address,
          cPrivateKey,
          amount,
        ),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "withdraw",
        user.index,
        await getNonce(user),
        amount,
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
    amount: bigint,
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateTransferProof(
        await sdk.getCircuitInputsForTransfer(
          user.address,
          cPrivateKey,
          to,
          amount,
        ),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "transfer",
        user.index,
        await getNonce(user),
        amount,
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
    pendingTransfersIndexes: number[],
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateApplyProof(
        await sdk.getCircuitInputsForApply(
          user.address,
          cPrivateKey,
          pendingTransfersIndexes,
        ),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "apply",
        user.index,
        await getNonce(user),
        undefined,
        pendingTransfersIndexes,
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
    amount: bigint,
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateApplyAndTransferProof(
        await sdk.getCircuitInputsForApplyAndTransfer(
          user.address,
          cPrivateKey,
          pendingTransfersIndexes,
          to,
          amount,
        ),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "applyAndTransfer",
        user.index,
        await getNonce(user),
        undefined,
        pendingTransfersIndexes,
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getApplyAndTransferParams(
      to,
      pendingTransfersIndexes,
      proofOutput,
    )
    await token.connect(user).cApplyAndTransfer(params)
    return proofOutput
  }

  const cClaim = async (
    _type: "hot" | "cold",
    user: typeof user1,
    indexToClaim: number,
  ): Promise<ProofOutput> => {
    let proofOutput: ProofOutput
    if (_type === "hot") {
      const { cPrivateKey } = await SDK.deriveConfidentialKeys(
        BigInt(user.privateKey),
      )
      proofOutput = await sdk.generateClaimProof(
        await sdk.getCircuitInputsForClaim(
          user.address,
          cPrivateKey,
          indexToClaim,
        ),
      )
    } else {
      const filename = getProofFilenameForColdTest(
        "claim",
        user.index,
        await getNonce(user),
      )
      proofOutput = getProofOutput(filename)
    }
    const params = sdk.getClaimParams(indexToClaim, proofOutput)
    await token.connect(user).cClaim(params)
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
    indexes?: number[],
  ) => {
    const filename = getProofFilenameForColdTest(
      operation,
      user,
      nonce,
      amount,
      indexes,
    )
    if (!fs.existsSync(path.join(PROOFS_DIR, `${filename}.json`))) {
      throw new Error(`Proof file ${filename} not found`)
    }
    return filename
  }

  const { cPrivateKey: user1CPrivateKey } = await SDK.deriveConfidentialKeys(
    BigInt(user1.privateKey),
  )
  const { cPrivateKey: user2CPrivateKey } = await SDK.deriveConfidentialKeys(
    BigInt(user2.privateKey),
  )

  return {
    conn,
    token,
    userUninitialized,
    user1,
    user2,
    user1CPrivateKey,
    user2CPrivateKey,
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
    cClaim,
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
  return setup("ConfidentialTransfers", false)
}

export async function baseSetup() {
  return initialize(await setup("ConfidentialTransfers", false))
}

export async function baseSetupBridgeableUninitializedUsers() {
  return setup("ConfidentialTransfersBridgeable", false)
}

export async function baseSetupBridgeable() {
  return initialize(await setup("ConfidentialTransfersBridgeable", false))
}
