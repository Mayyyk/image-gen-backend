// const generateImage = async (prompt) => {
//     try {
// 		const { prompt } = req.body;
		
// 		if (!prompt) {
// 			return res.status(400).json({ error: 'Prompt is required' });
// 		}

// 		console.log('Starting image generation with prompt:', prompt);

// 		// Using Stable Diffusion v2.1
// 		const prediction = await replicate.predictions.create({
// 			version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
// 			input: {
// 				prompt: prompt,
// 				num_outputs: 1,
// 				num_inference_steps: 30,
// 				guidance_scale: 7.5,
// 				scheduler: "DPMSolverMultistep",  // One of the faster schedulers
// 				width: 768,
// 				height: 768
// 			}
// 		});

// 		console.log('Prediction started:', prediction);

// 		let finalPrediction = await replicate.predictions.get(prediction.id);
// 		let attempts = 0;
// 		const maxAttempts = 30; // 30 seconds timeout
		
// 		while (attempts < maxAttempts) {
// 			console.log(`Waiting for prediction... Status: ${finalPrediction.status} (Attempt ${attempts + 1}/${maxAttempts})`);
			
// 			if (finalPrediction.status === 'succeeded') {
// 				break;
// 			}
			
// 			if (finalPrediction.status === 'failed') {
// 				throw new Error('Image generation failed: ' + finalPrediction.error);
// 			}

// 			if (finalPrediction.status === 'canceled') {
// 				throw new Error('Image generation was canceled');
// 			}

// 			await new Promise(resolve => setTimeout(resolve, 1000));
// 			finalPrediction = await replicate.predictions.get(prediction.id);
// 			attempts++;
// 		}

// 		if (attempts >= maxAttempts) {
// 			throw new Error('Image generation timed out after 30 seconds');
// 		}

// 		if (!finalPrediction.output) {
// 			throw new Error('No output received from image generation');
// 		}

// 		console.log('Generation successful:', finalPrediction.output);

// 		const imageUrl = Array.isArray(finalPrediction.output) 
// 			? finalPrediction.output[0] 
// 			: finalPrediction.output;

// 		res.json({ imageUrl });
// 	} catch (error) {
// 		console.error('Detailed generation error:', {
// 			message: error.message,
// 			stack: error.stack,
// 			name: error.name
// 		});
		
// 		res.status(500).json({ 
// 			error: 'Failed to generate image',
// 			details: error.message
// 		});
// 	}
// };

// export default generateImage;