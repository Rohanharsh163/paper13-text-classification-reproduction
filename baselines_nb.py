import sys, random, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import repro as R
import numpy as np, torch
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import f1_score
from scipy.sparse import csr_matrix

def setup(ds):
    train, test, K = R.load_dataset(ds)
    random.Random(123).shuffle(train); random.Random(124).shuffle(test)
    test = test[:1000]
    val, pool = train[:200], train[200:]
    vocab = R.Vocab([t for t, _ in pool], K)
    return pool, val, test, K, vocab

def subsample(pool, n, seed):
    idx = list(range(len(pool))); random.Random(seed).shuffle(idx)
    return [pool[i] for i in idx[:n]]
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score
from scipy.sparse import csr_matrix
def bow(ids_list, V):
    rows, cols = [], []
    for i, ids in enumerate(ids_list):
        for t in ids: rows.append(i); cols.append(t)
    return csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(len(ids_list), V))
for ds in ['agnews', 'sst2']:
    pool, val, test, K, vocab = setup(ds)
    Xt = bow([vocab.encode(t) for t, _ in test], vocab.size); Yt = [y for _, y in test]
    for n in [128, 512, 2048]:
        nb, lr = [], []
        for seed in [0, 1]:
            sub = subsample(pool, n, seed)
            X = bow([vocab.encode(t) for t, _ in sub], vocab.size); Y = [y for _, y in sub]
            nb.append(f1_score(Yt, MultinomialNB(alpha=1.0).fit(X, Y).predict(Xt), average='weighted'))
            lr.append(f1_score(Yt, LogisticRegression(max_iter=1000, C=10).fit(X, Y).predict(Xt), average='weighted'))
        print(f"{ds} n={n}: NaiveBayes {np.mean(nb):.3f} (seeds {nb[0]:.3f},{nb[1]:.3f})  LogReg {np.mean(lr):.3f}", flush=True)
