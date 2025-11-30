// Enoki Sponsored Transaction Backend Proxy

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { EnokiClient } from '@mysten/enoki';

const app = express();
app.use(cors());
app.use(express.json());

const ENOKI_PRIVATE_KEY = process.env.ENOKI_PRIVATE_KEY;
const PORT = process.env.PORT || 3001;

if (!ENOKI_PRIVATE_KEY) {
  console.error('ENOKI_PRIVATE_KEY environment variable is required!');
  process.exit(1);
}

const enokiClient = new EnokiClient({
  apiKey: ENOKI_PRIVATE_KEY,
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/sponsor', async (req, res) => {
  try {
    const { network, transactionKindBytes, sender } = req.body;

    console.log('Sponsor request:', { network, sender });

    if (!transactionKindBytes || !sender) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Send allowed targets directly to Enoki API
    const response = await enokiClient.createSponsoredTransaction({
      network: network || 'testnet',
      transactionKindBytes,
      sender,
      allowedMoveCallTargets: [
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::register_recipient',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::create_verification_proposal',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::vote_on_proposal',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::execute_proposal',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::create_aid_package',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::assign_recipient',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::mark_delivered',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::aidchain::release_funds',
        '0xd304461bb12677e9eec7cbc94cbca595af44e362fef1594b41c6b4ef618de3da::impact_nft::mint_impact_nft',
      ],
    });

    console.log('Sponsor success:', response.digest);

    res.json({
      bytes: response.bytes,
      digest: response.digest,
    });
  } catch (error) {
    console.error('Sponsor error:', error.message);
    console.error('Sponsor error details:', JSON.stringify(error.errors || [], null, 2));
    res.status(error.status || 500).json({ 
      error: error.message,
      details: error.errors || [],
    });
  }
});

app.post('/api/execute', async (req, res) => {
  try {
    const { digest, signature } = req.body;

    if (!digest || !signature) {
      return res.status(400).json({ error: 'Missing digest or signature' });
    }

    const response = await enokiClient.executeSponsoredTransaction({
      digest,
      signature,
    });

    res.json({
      digest: response.digest,
    });
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.errors || [],
    });
  }
});

app.listen(PORT, () => {
  console.log(`Enoki Sponsor Backend running on port ${PORT}`);
});
