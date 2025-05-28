import { getTokenTraits } from '../../../lib/blockchain';

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    console.log(`[metadata] Obteniendo traits para token ${id}...`);
    const traits = await getTokenTraits(id);
    console.log(`[metadata] Traits obtenidos:`, JSON.stringify(traits, null, 2));

    // Construir atributos para OpenSea
    const attributes = traits.categories.map((category, index) => ({
      trait_type: category,
      value: traits.traitIds[index].toString()
    }));

    // Añadir atributos especiales
    attributes.push(
      { trait_type: "Generation", value: traits.generation.toString() },
      { trait_type: "Mutation Level", value: traits.mutationLevel.toString() },
      { trait_type: "Can Replicate", value: traits.canReplicate.toString() },
      { trait_type: "Replication Count", value: traits.replicationCount.toString() },
      { trait_type: "Has Been Modified", value: traits.hasBeenModified.toString() }
    );

    const metadata = {
      name: `BareAdrian #${id}`,
      description: `A dynamic character from the AdrianLab experiment`,
      image: `https://adrianlab.vercel.app/api/render/${id}`,
      external_url: `https://adrianlab.vercel.app/token/${id}`,
      attributes
    };

    console.log(`[metadata] Enviando metadata:`, JSON.stringify(metadata, null, 2));
    res.status(200).json(metadata);

  } catch (error) {
    console.error(`[metadata] Error:`, error);
    res.status(404).json({ error: 'Token not found or data unavailable' });
  }
} 