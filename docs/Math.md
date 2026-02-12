## cPrivateKey = P(ethPrivateKey) || P(sign(randomBytes))

## OTK = P(cPprivateKey, nonce)

## Commitment = P(amount, OTK)

## SharedKey = ECDH(cPprivateKey, cPubKeys)

## eAmount = amount + P(OTK, nonce)

## eOTK = OTK + P(SharedKey, nonce)
