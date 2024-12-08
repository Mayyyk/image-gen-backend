import express from 'express';
import bcrypt from 'bcrypt-nodejs';
import cors from 'cors';
import knex from 'knex';
import Replicate from 'replicate';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure dotenv with the specific path to your .env file
dotenv.config({ path: join(__dirname, '.env') });

// Verify environment
console.log('Environment check:', {
	hasToken: !!process.env.REPLICATE_API_TOKEN,
	nodeEnv: process.env.NODE_ENV,
	tokenStart: process.env.REPLICATE_API_TOKEN?.substring(0, 4), // Show first 4 chars of token
});

const app = express();

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

const db = knex({
	client: 'pg',
	connection: {
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false,
		},
	},
});

const test = () => {
	db.raw('SELECT 1')
		.then(() => {
			console.log('Database connected successfully');
		})
		.catch((err) => {
			console.error('Error connecting to the database:', err);
		});
};

// test();

app.use(
	cors({
		origin: ['https://brain-sigma-pearl.vercel.app', 'http://localhost:3000'],
		methods: ['GET', 'POST', 'PUT', 'DELETE'],
		credentials: true,
		allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
	})
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/signin', (req, res) => {
	db.select('email', 'hash')
		.from('login')
		.where('email', req.body.email)
		.then((data) => {
			if (data.length === 0) {
				return res.status(400).json('wrong credentials'); // User not found
			}
			if (bcrypt.compareSync(req.body.password, data[0].hash)) {
				return db
					.select('*')
					.from('users')
					.where('email', req.body.email)
					.then((user) => {
						res.json(user[0]);
					})
					.catch((err) => res.status(400).json('unable to get user'));
			} else {
				res.status(400).json('wrong credentials');
			}
		});
});

app.post('/register', (req, res) => {
	const { name, email, password } = req.body;

	// Input validation
	if (!email || !name || !password) {
		return res.status(400).json({ error: 'Missing required fields' });
	}

	// Hash the password
	bcrypt.hash(password, null, null, function (err, hash) {
		if (err) {
			console.error('Hash error:', err);
			return res.status(500).json({ error: 'Error during password hashing' });
		}

		// Using transaction to ensure both operations succeed or fail together
		db.transaction((trx) => {
			trx('login')
				.insert({
					hash: hash,
					email: email,
				})
				.returning('email')
				.then((loginEmail) => {
					return trx('users')
						.insert({
							email: loginEmail[0].email,
							name: name,
							joined: new Date(),
							entries: 0,
						})
						.returning('*');
				})
				.then((user) => {
					res.json(user[0]); // Send back the created user
				})
				.then(trx.commit)
				.catch(trx.rollback);
		}).catch((err) => {
			console.error('Registration error:', err);
			if (err.code === '23505') {
				// PostgreSQL unique violation error
				res.status(400).json({ error: 'User already exists' });
			} else {
				res.status(500).json({ error: 'Unable to register' });
			}
		});
	});
});

app.get('/profile/:id', async (req, res) => {
	const { id } = req.params;

	try {
		const user = await db('users').where('id', id).first();

		if (!user) {
			return res.status(404).json({ error: 'User not found' });
		}
		res.json(user);
	} catch (err) {
		res.status(500).json({ error: 'Error fetching user' });
	}
});

// Initialize Replicate with API token
const replicate = new Replicate({
	auth: process.env.REPLICATE_API_TOKEN,
});

// Test the Replicate connection
const testReplicate = async () => {
	try {
		console.log('Testing Replicate connection...');

		const prediction = await replicate.predictions.create({
			version:
				'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf',
			input: {
				prompt: 'a test image of a cute cat',
				num_outputs: 1,
			},
		});

		console.log('Prediction started:', prediction);

		// Wait for the prediction to complete
		let finalPrediction = await replicate.predictions.get(prediction.id);
		while (
			finalPrediction.status !== 'succeeded' &&
			finalPrediction.status !== 'failed'
		) {
			console.log('Waiting for prediction...', finalPrediction.status);
			await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
			finalPrediction = await replicate.predictions.get(prediction.id);
		}

		console.log('Successfully connected to Replicate');
		console.log('Final prediction:', finalPrediction);

		if (finalPrediction.output) {
			console.log('Generated image URL:', finalPrediction.output);
		}
	} catch (error) {
		console.error('Failed to connect to Replicate:', {
			name: error.name,
			message: error.message,
			cause: error.cause,
		});
	}
};

// Run the test
// await testReplicate();

app.post('/generate-image', async (req, res) => {
	console.log('Received generation request:', req.body);

	try {
		const { prompt, id } = req.body; // Get both prompt and user id

		if (!prompt) {
			return res.status(400).json({ error: 'Prompt is required' });
		}

		if (!id) {
			return res.status(400).json({ error: 'User ID is required' });
		}

		console.log('Starting image generation with prompt:', prompt);

		// Generate image with Stable Diffusion
		const prediction = await replicate.predictions.create({
			version:
				'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf',
			input: {
				prompt: prompt,
				num_outputs: 1,
				num_inference_steps: 30,
				guidance_scale: 7.5,
				scheduler: 'DPMSolverMultistep',
				width: 768,
				height: 768,
			},
		});

		console.log('Prediction started:', prediction);

		let finalPrediction = await replicate.predictions.get(prediction.id);
		let attempts = 0;
		const maxAttempts = 30;

		while (attempts < maxAttempts) {
			console.log(
				`Waiting for prediction... Status: ${finalPrediction.status} (Attempt ${
					attempts + 1
				}/${maxAttempts})`
			);

			if (finalPrediction.status === 'succeeded') {
				break;
			}

			if (finalPrediction.status === 'failed') {
				throw new Error('Image generation failed: ' + finalPrediction.error);
			}

			if (finalPrediction.status === 'canceled') {
				throw new Error('Image generation was canceled');
			}

			await new Promise((resolve) => setTimeout(resolve, 1000));
			finalPrediction = await replicate.predictions.get(prediction.id);
			attempts++;
		}
		if (attempts >= maxAttempts) {
			throw new Error('Image generation timed out after 30 seconds');
		}
		// If image generation was successful, update entries
		if (finalPrediction.status === 'succeeded') {
			try {
				const entries = await db('users')
					.where('id', id)
					.increment('entries', 1)
					.returning(['entries', 'name']); // Return both entries and name

				if (entries.length === 0) {
					return res.status(404).json({ error: 'User not found' });
				}

				const imageUrl = Array.isArray(finalPrediction.output)
					? finalPrediction.output[0]
					: finalPrediction.output;

				// Return both the image URL and updated user data
				res.json({
					imageUrl,
					entries: entries[0].entries,
					name: entries[0].name,
				});
			} catch (err) {
				console.error('Database error:', err);
				res.status(400).json({ error: 'Unable to update entries' });
			}
		} else {
			throw new Error('Image generation timed out');
		}
	} catch (error) {
		console.error('Generation error:', error);
		res.status(500).json({
			error: 'Failed to generate image',
			details: error.message,
		});
	}
});

app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
});
