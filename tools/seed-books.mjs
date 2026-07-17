import mongoose from 'mongoose';

const books = [
  {
    title: 'Dune',
    author: 'Frank Herbert',
    publishedYear: 1965,
    description:
      'A sweeping science-fiction epic of politics, ecology, and destiny.',
  },
  {
    title: 'Nineteen Eighty-Four',
    author: 'George Orwell',
    publishedYear: 1949,
    description:
      'A landmark dystopian novel about surveillance, truth, and power.',
  },
  {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    publishedYear: 1813,
    description: 'A sharp, warm story of manners, misunderstanding, and love.',
  },
  {
    title: 'The Hobbit',
    author: 'J.R.R. Tolkien',
    publishedYear: 1937,
    description:
      'Bilbo Baggins leaves home for an unexpected and remarkable adventure.',
  },
  {
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    publishedYear: 1960,
    description:
      'A coming-of-age story shaped by justice, empathy, and moral courage.',
  },
  {
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    publishedYear: 1925,
    description: 'A glittering and tragic portrait of longing in the Jazz Age.',
  },
  {
    title: 'One Hundred Years of Solitude',
    author: 'Gabriel García Márquez',
    publishedYear: 1967,
    description:
      'Generations of the Buendía family live through wonder, love, and loss.',
  },
  {
    title: 'The Left Hand of Darkness',
    author: 'Ursula K. Le Guin',
    publishedYear: 1969,
    description:
      'A thoughtful exploration of identity, culture, loyalty, and belonging.',
  },
  {
    title: 'The Name of the Rose',
    author: 'Umberto Eco',
    publishedYear: 1980,
    description:
      'A medieval mystery rich with books, ideas, and dangerous secrets.',
  },
  {
    title: 'Beloved',
    author: 'Toni Morrison',
    publishedYear: 1987,
    description:
      'A powerful novel of memory, family, freedom, and the weight of history.',
  },
  {
    title: "The Handmaid's Tale",
    author: 'Margaret Atwood',
    publishedYear: 1985,
    description:
      'A chilling story of resistance within a rigid authoritarian society.',
  },
  {
    title: 'The Book Thief',
    author: 'Markus Zusak',
    publishedYear: 2005,
    description:
      'A young reader finds courage and connection through stolen books.',
  },
  {
    title: 'The Shadow of the Wind',
    author: 'Carlos Ruiz Zafón',
    publishedYear: 2001,
    description:
      'A literary mystery set among forgotten books in postwar Barcelona.',
  },
  {
    title: 'Never Let Me Go',
    author: 'Kazuo Ishiguro',
    publishedYear: 2005,
    description:
      'A quiet, haunting reflection on friendship, memory, and humanity.',
  },
  {
    title: 'The Road',
    author: 'Cormac McCarthy',
    publishedYear: 2006,
    description: 'A father and son carry hope through a devastated landscape.',
  },
  {
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    publishedYear: 1988,
    description:
      'A simple fable about purpose, perseverance, and following a dream.',
  },
  {
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    publishedYear: 1943,
    description:
      'A tender philosophical tale about friendship and what truly matters.',
  },
  {
    title: 'The Master and Margarita',
    author: 'Mikhail Bulgakov',
    publishedYear: 1967,
    description:
      'A surreal satire where the devil arrives in Soviet-era Moscow.',
  },
  {
    title: 'Jane Eyre',
    author: 'Charlotte Brontë',
    publishedYear: 1847,
    description:
      'An independent young woman searches for dignity, home, and love.',
  },
  {
    title: 'Frankenstein',
    author: 'Mary Shelley',
    publishedYear: 1818,
    description:
      'A foundational tale of ambition, creation, isolation, and responsibility.',
  },
];

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';

try {
  await mongoose.connect(uri, { dbName: 'geek_library' });
  const collection = mongoose.connection.collection('books');
  const now = new Date();
  const result = await collection.bulkWrite(
    books.map((book) => ({
      updateOne: {
        filter: { title: book.title, author: book.author },
        update: {
          $setOnInsert: {
            ...book,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
  );
  const total = await collection.countDocuments();

  console.log(
    `Seed complete: ${result.upsertedCount} added, ${total} total books.`,
  );
} catch (error) {
  console.error('Unable to seed the books database.', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
