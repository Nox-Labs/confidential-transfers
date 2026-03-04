package sdk

import (
	"math/big"

	"github.com/iden3/go-iden3-crypto/babyjub"
	"github.com/iden3/go-iden3-crypto/ff"
	"github.com/iden3/go-iden3-crypto/poseidon"
)

// Poseidon computes the Poseidon hash of the given inputs.
func Poseidon(inputs []*big.Int) (*big.Int, error) {
	return poseidon.Hash(inputs)
}

// GenerateCommitment generates a commitment using Poseidon hash of amount and otk.
func GenerateCommitment(amount, otk *big.Int) (*big.Int, error) {
	return Poseidon([]*big.Int{amount, otk})
}

// GenerateOTK generates a One-Time Key (OTK) using Poseidon hash.
func GenerateOTK(key, nonce, chainId, contractAddress *big.Int) (*big.Int, error) {
	return Poseidon([]*big.Int{key, nonce, chainId, contractAddress})
}

// DecryptAmount is a helper that generates OTK and then deciphers.
func DecryptAmount(key, nonce, eAmount, chainId, contractAddress *big.Int) (*big.Int, error) {
	otk, err := GenerateOTK(key, nonce, chainId, contractAddress)
	if err != nil {
		return nil, err
	}
	return Decipher(otk, nonce, eAmount)
}

// DeriveSharedKey derives a shared key from a private key and a public key point.
func DeriveSharedKey(cPrivateKey *big.Int, cPublicKeyX, cPublicKeyY *big.Int) (*big.Int, error) {
	// Create a point from X and Y
	publicKeyPoint := &babyjub.Point{X: cPublicKeyX, Y: cPublicKeyY}

	// Check if point is on curve? Ideally yes, but MulPointEscalar handles points.
	// In JS: babyJub.mulPointEscalar([cPublicKeyX, cPublicKeyY], cPrivateKey)

	// babyjub.MulPointEscalar returns a new point
	sharedKeyPoint := babyjub.NewPoint().Mul(cPrivateKey, publicKeyPoint)

	// Return the X coordinate
	return sharedKeyPoint.X, nil
}

type ConfidentialKeys struct {
	CPrivateKey *big.Int
	CPublicKeyX *big.Int
	CPublicKeyY *big.Int
}

// DeriveConfidentialKeys derives confidential keys from entropy.
func DeriveConfidentialKeys(entropy *big.Int) (*ConfidentialKeys, error) {
	// circomlibjs coerces bigint inputs into the field; mirror that behavior here.
	entropyInField := new(big.Int).Mod(entropy, ff.Modulus())

	// entropyHash = poseidon([entropy])
	entropyHash, err := Poseidon([]*big.Int{entropyInField})
	if err != nil {
		return nil, err
	}

	// cPrivateKey = entropyHash % babyjub.SubOrder
	cPrivateKey := new(big.Int).Mod(entropyHash, babyjub.SubOrder)

	// publicKeyPoint = babyjub.Base8 * cPrivateKey
	// Base8 is the generator point of the subgroup.
	// In go-iden3-crypto, we have babyjub.B8
	publicKeyPoint := babyjub.NewPoint().Mul(cPrivateKey, babyjub.B8)

	return &ConfidentialKeys{
		CPrivateKey: cPrivateKey,
		CPublicKeyX: publicKeyPoint.X,
		CPublicKeyY: publicKeyPoint.Y,
	}, nil
}

// Cipher encrypts the plaintext using Poseidon stream cipher.
func Cipher(key, nonce, plaintext *big.Int) (*big.Int, error) {
	// keystream = poseidon([key, nonce])
	keystream, err := Poseidon([]*big.Int{key, nonce})
	if err != nil {
		return nil, err
	}

	return new(big.Int).Add(plaintext, keystream), nil
}

// Decipher decrypts the ciphertext.
func Decipher(key, nonce, ciphertext *big.Int) (*big.Int, error) {
	// keystream = poseidon([key, nonce])
	keystream, err := Poseidon([]*big.Int{key, nonce})
	if err != nil {
		return nil, err
	}

	return new(big.Int).Sub(ciphertext, keystream), nil
}
