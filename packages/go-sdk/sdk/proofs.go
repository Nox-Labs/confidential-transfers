package sdk

import (
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

type Prover interface {
	Prove(inputs any, circuitName string) (*ProofOutput, error)
}

type SnarkJSProver struct {
	ZKeyDir string // contains {circuit}/{circuit}_final.zkey
	WasmDir string // contains {circuit}_js/{circuit}.wasm
	Binary  string // e.g. "npx snarkjs" or just "snarkjs"
}

func NewSnarkJSProver(zkeyDir, wasmDir, binary string) *SnarkJSProver {
	if binary == "" {
		binary = "snarkjs"
	}
	return &SnarkJSProver{ZKeyDir: zkeyDir, WasmDir: wasmDir, Binary: binary}
}

func (p *SnarkJSProver) Prove(inputs any, circuitName string) (*ProofOutput, error) {
	tmpDir := filepath.Join(os.TempDir(), "proof-"+uuid.New().String())
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	inputPath := filepath.Join(tmpDir, "input.json")
	proofPath := filepath.Join(tmpDir, "proof.json")
	publicPath := filepath.Join(tmpDir, "public.json")

	inputBytes, err := marshalAsStrings(inputs)
	if err != nil {
		return nil, fmt.Errorf("marshal inputs: %w", err)
	}
	if err := os.WriteFile(inputPath, inputBytes, 0644); err != nil {
		return nil, fmt.Errorf("write input.json: %w", err)
	}

	wasmPath := filepath.Join(p.WasmDir, circuitName+"_js", circuitName+".wasm")
	zkeyPath := filepath.Join(p.ZKeyDir, circuitName, circuitName+"_final.zkey")

	if _, err := os.Stat(zkeyPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("zkey not found: %s", zkeyPath)
	}

	// snarkjs plonk fullprove input.json circuit.wasm circuit.zkey proof.json public.json
	cmd := p.command("plonk", "fullprove", inputPath, wasmPath, zkeyPath, proofPath, publicPath)
	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("snarkjs fullprove: %v\noutput: %s", err, string(output))
	}

	// snarkjs zkey export soliditycalldata public.json proof.json
	cmd = p.command("zkey", "export", "soliditycalldata", publicPath, proofPath)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("snarkjs export calldata: %w", err)
	}

	return parseCalldata(string(output))
}

func (p *SnarkJSProver) command(args ...string) *exec.Cmd {
	parts := strings.Fields(p.Binary)
	return exec.Command(parts[0], append(parts[1:], args...)...)
}

func parseCalldata(raw string) (*ProofOutput, error) {
	fixed := strings.ReplaceAll(strings.TrimSpace(raw), "][", "],[")
	jsonStr := fmt.Sprintf("[%s]", fixed)

	var parsed []any
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		return nil, fmt.Errorf("parse calldata: %w", err)
	}
	if len(parsed) < 2 {
		return nil, fmt.Errorf("expected 2 arrays in calldata, got %d", len(parsed))
	}

	proof, err := toBigInts(parsed[0])
	if err != nil {
		return nil, fmt.Errorf("parse proof: %w", err)
	}
	pubSignals, err := toBigInts(parsed[1])
	if err != nil {
		return nil, fmt.Errorf("parse pubSignals: %w", err)
	}

	return &ProofOutput{Proof: proof, PubSignals: pubSignals}, nil
}

func toBigInts(v any) ([]*big.Int, error) {
	switch val := v.(type) {
	case string:
		n, ok := new(big.Int).SetString(strings.TrimPrefix(val, "0x"), 16)
		if !ok {
			return nil, fmt.Errorf("invalid hex: %q", val)
		}
		return []*big.Int{n}, nil
	case []any:
		result := make([]*big.Int, len(val))
		for i, elem := range val {
			s, ok := elem.(string)
			if !ok {
				return nil, fmt.Errorf("element %d is not a string", i)
			}
			n, ok := new(big.Int).SetString(strings.TrimPrefix(s, "0x"), 16)
			if !ok {
				return nil, fmt.Errorf("invalid hex at %d: %q", i, s)
			}
			result[i] = n
		}
		return result, nil
	default:
		return nil, fmt.Errorf("unexpected type: %T", v)
	}
}

// marshalAsStrings serializes inputs to JSON with all numeric values as strings
// (required by snarkjs circuit inputs).
func marshalAsStrings(inputs any) ([]byte, error) {
	raw, err := json.Marshal(inputs)
	if err != nil {
		return nil, err
	}

	var m any
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	if err := dec.Decode(&m); err != nil {
		return nil, err
	}

	return json.Marshal(numbersToStrings(m))
}

func numbersToStrings(v any) any {
	switch val := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(val))
		for k, v := range val {
			out[k] = numbersToStrings(v)
		}
		return out
	case []any:
		out := make([]any, len(val))
		for i, v := range val {
			out[i] = numbersToStrings(v)
		}
		return out
	case json.Number:
		return val.String()
	default:
		return val
	}
}

// --- SDK proof generation methods ---

func (s *SDK) GenerateInitProof(inputs *CircuitInitInputs) (*ProofOutput, error) {
	return s.prover.Prove(inputs, "init")
}

func (s *SDK) GenerateUpdateProof(inputs *CircuitUpdateInputs) (*ProofOutput, error) {
	return s.prover.Prove(inputs, "update")
}

func (s *SDK) GenerateTransferProof(inputs *CircuitTransferInputs) (*ProofOutput, error) {
	return s.prover.Prove(inputs, "transfer")
}

func (s *SDK) GenerateApplyProof(inputs *CircuitApplyInputs) (*ProofOutput, error) {
	return s.prover.Prove(inputs, "apply")
}

func (s *SDK) GenerateApplyAndTransferProof(inputs *CircuitApplyAndTransferInputs) (*ProofOutput, error) {
	return s.prover.Prove(inputs, "applyAndTransfer")
}

func (s *SDK) GenerateClaimProof(inputs *CircuitClaimInputs) (*ProofOutput, error) {
	return s.prover.Prove(inputs, "claim")
}
