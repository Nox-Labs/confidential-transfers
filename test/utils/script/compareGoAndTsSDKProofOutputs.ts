import * as fs from "fs"
import * as path from "path"

const TS_DIR = path.resolve(import.meta.dirname, "proofs")
const GO_DIR = path.resolve(
  import.meta.dirname,
  "../../../packages/go-sdk/cmd/cold_tests_proofs/proofs",
)

const tsFiles = fs.readdirSync(TS_DIR).filter((f) => f.endsWith(".json"))

let passed = 0
let failed = 0
let missing = 0

for (const file of tsFiles) {
  const goPath = path.join(GO_DIR, file)

  if (!fs.existsSync(goPath)) {
    console.log(`⏭  SKIP  ${file} (not found in Go SDK)`)
    missing++
    continue
  }

  const tsData = JSON.parse(fs.readFileSync(path.join(TS_DIR, file), "utf8"))
  const goData = JSON.parse(fs.readFileSync(goPath, "utf8"))

  const tsPub: string[] = tsData.pubSignals.map((s: string) =>
    BigInt(s).toString(),
  )
  const goPub: string[] = goData.pubSignals.map((s: string) =>
    BigInt(s).toString(),
  )

  if (tsPub.length !== goPub.length) {
    console.log(
      `✗  FAIL  ${file} — pubSignals length mismatch: TS=${tsPub.length} Go=${goPub.length}`,
    )
    failed++
    continue
  }

  const diffs: number[] = []
  for (let i = 0; i < tsPub.length; i++) {
    if (tsPub[i] !== goPub[i]) diffs.push(i)
  }

  if (diffs.length === 0) {
    console.log(`✓  PASS  ${file}`)
    passed++
  } else {
    console.log(`✗  FAIL  ${file} — pubSignals differ at indices: [${diffs}]`)
    for (const i of diffs) {
      console.log(`         [${i}] TS: ${tsData.pubSignals[i]}`)
      console.log(`         [${i}] Go: ${goData.pubSignals[i]}`)
    }
    failed++
  }
}

console.log(
  `\nResults: ${passed} passed, ${failed} failed, ${missing} skipped (missing in Go)`,
)
console.log(`Total TS proofs: ${tsFiles.length}`)

process.exit(failed + missing > 0 ? 1 : 0)
