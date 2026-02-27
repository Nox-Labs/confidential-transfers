.PHONY: update ensure-abigen extract-abi generate-proofs-for-cold-test

ARTIFACTS_DIR=../../out/foundry
PKG_CONTRACT_DIR=sdk/artifacts/contracts
ABI_DIR=sdk/artifacts/abi

ensure-abigen:
	@which abigen > /dev/null || (echo "Installing abigen..." && go install github.com/ethereum/go-ethereum/cmd/abigen@latest)

extract-abi:
	@echo "Extracting ABIs..."
	@mkdir -p $(ABI_DIR)
	@node -e "const fs=require('fs'); const p=require('path'); ['ConfidentialTransfers', 'ConfidentialTransfersBridgeable', 'ConfidentialOFT'].forEach(n => { try { const art=JSON.parse(fs.readFileSync('$(ARTIFACTS_DIR)/'+n+'.sol/'+n+'.json', 'utf8')); const abi=JSON.stringify(art.abi, null, 2); fs.writeFileSync('$(ABI_DIR)/'+n+'.json', abi); console.log('Extracted:', n); } catch(e) { console.error('Failed to extract', n, e.message); process.exit(1); } })"

update: ensure-abigen extract-abi
	@echo "Generating Go bindings..."
	
	@mkdir -p $(PKG_CONTRACT_DIR)/ConfidentialTransfers
	@abigen --abi=$(ABI_DIR)/ConfidentialTransfers.json \
		--pkg=confidential_transfers \
		--type=ConfidentialTransfers \
		--out=$(PKG_CONTRACT_DIR)/ConfidentialTransfers/confidential_transfers.go

	@mkdir -p $(PKG_CONTRACT_DIR)/ConfidentialTransfersBridgeable
	@abigen --abi=$(ABI_DIR)/ConfidentialTransfersBridgeable.json \
		--pkg=confidential_transfers_bridgeable \
		--type=ConfidentialTransfersBridgeable \
		--out=$(PKG_CONTRACT_DIR)/ConfidentialTransfersBridgeable/confidential_transfers_bridgeable.go

	@mkdir -p $(PKG_CONTRACT_DIR)/ConfidentialOFT
	@abigen --abi=$(ABI_DIR)/ConfidentialOFT.json \
		--pkg=confidential_oft \
		--type=ConfidentialOFT \
		--out=$(PKG_CONTRACT_DIR)/ConfidentialOFT/confidential_oft.go
		
	@echo "Done."

generate-proofs-for-cold-test:
	@anvil > /dev/null 2>&1 & ANVIL_PID=$$!; \
	trap "kill $$ANVIL_PID 2>/dev/null" EXIT; \
	sleep 2; \
	echo "Deploying contracts..." && \
	forge script Deploy -s 'deploy(string)' anvil --broadcast --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --unlocked && \
	echo "Generating proofs..." && \
	go run cmd/cold_tests_proofs/main.go && \
	echo "Done."