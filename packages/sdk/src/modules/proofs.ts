import { Utils } from "./utils.js"
import { plonk } from "snarkjs"
import {
  SDKOptions,
  ProofOutput,
  CircuitInputs,
  CircuitInitInputs,
  CircuitUpdateInputs,
  CircuitTransferInputs,
  CircuitApplyInputs,
  CircuitApplyAndTransferInputs,
  CircuitClaimInputs,
} from "./types.js"

export class Proofs extends Utils {
  private readonly options: SDKOptions
  constructor(_options: SDKOptions) {
    super()

    this.options = _options
  }

  async generateInitProof(
    circuitInputs: CircuitInitInputs,
  ): Promise<ProofOutput> {
    return await this.generateProof(
      circuitInputs,
      `${this.options.paths.helpers}/init_js/init.wasm`,
      `${this.options.paths.keys}/init/init_final.zkey`,
    )
  }
  async generateUpdateProof(
    circuitInputs: CircuitUpdateInputs,
  ): Promise<ProofOutput> {
    return await this.generateProof(
      circuitInputs,
      `${this.options.paths.helpers}/update_js/update.wasm`,
      `${this.options.paths.keys}/update/update_final.zkey`,
    )
  }
  async generateTransferProof(
    circuitInputs: CircuitTransferInputs,
  ): Promise<ProofOutput> {
    return await this.generateProof(
      circuitInputs,
      `${this.options.paths.helpers}/transfer_js/transfer.wasm`,
      `${this.options.paths.keys}/transfer/transfer_final.zkey`,
    )
  }
  async generateApplyProof(
    circuitInputs: CircuitApplyInputs,
  ): Promise<ProofOutput> {
    return await this.generateProof(
      circuitInputs,
      `${this.options.paths.helpers}/apply_js/apply.wasm`,
      `${this.options.paths.keys}/apply/apply_final.zkey`,
    )
  }
  async generateApplyAndTransferProof(
    circuitInputs: CircuitApplyAndTransferInputs,
  ): Promise<ProofOutput> {
    return await this.generateProof(
      circuitInputs,
      `${this.options.paths.helpers}/applyAndTransfer_js/applyAndTransfer.wasm`,
      `${this.options.paths.keys}/applyAndTransfer/applyAndTransfer_final.zkey`,
    )
  }
  async generateClaimProof(
    circuitInputs: CircuitClaimInputs,
  ): Promise<ProofOutput> {
    return await this.generateProof(
      circuitInputs,
      `${this.options.paths.helpers}/claim_js/claim.wasm`,
      `${this.options.paths.keys}/claim/claim_final.zkey`,
    )
  }

  private async generateProof(
    circuitInputs: CircuitInputs,
    wasmPath: string,
    zkeyPath: string,
  ): Promise<ProofOutput> {
    const { proof, publicSignals } = await plonk.fullProve(
      circuitInputs,
      wasmPath,
      zkeyPath,
    )

    const calldata = await plonk.exportSolidityCallData(proof, publicSignals)
    const calldataFixed = calldata.replace(/\]\[/g, "],[")
    const [proofArgs, pubSignalsArgs] = JSON.parse(`[${calldataFixed}]`)

    return { proof: proofArgs, pubSignals: pubSignalsArgs }
  }
}
