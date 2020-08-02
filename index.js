const cardsContainer = document.getElementById('cards-container');
let myIntervalID;

let cardsDataPromise = getCardsData();
cardsDataPromise
	.then((cardsData) => {
		let dataCameFromSessionStorage = typeof cardsData === 'string';
		if (dataCameFromSessionStorage) {
			return Promise.resolve(JSON.parse(cardsData));
		} else {
			return cardsData.json();
		}
	})
	.then((cardsDataJson) => {
		prepareGame(cardsDataJson);
	})
	.catch(() => {
		showError();
	});

let matchInfo = {
	attempts: 0,
	currentCard: undefined,
	lastCard: undefined,
	correctlyGuessedPairs: 0, //debería ser well-guessedPairs? o correctlyGuessedPairs?
	resetCurrentAndLastCard() {
		matchInfo.currentCard = undefined;
		matchInfo.lastCard = undefined;
	}
};

//Funciones

function getCardsData() {
	if (sessionStorage.getItem('cardsData') === null) {
		return fetch('https://deckofcardsapi.com/api/deck/new/draw/?count=8');
	} else {
		return Promise.resolve(sessionStorage.getItem('cardsData'));
	}
}

function prepareGame(cardsData) {
	//se guarda la info de las cartas ante posible partida nueva al recargar la página
	sessionStorage.setItem('cardsData', JSON.stringify(cardsData));
	//preparación de cartas...
	const duplicatedCards = duplicateCards(cardsData.cards);
	const shuffledCards = shuffleCards(duplicatedCards);
	positionCards(shuffledCards);
	//Actualización del contador de tiempo restante
	myIntervalID = setInterval(updateTimeRemaining, 1000);
	allowPointerEventsInCards();
}
function allowPointerEventsInCards() {
	cardsContainer.classList.remove('pointer-events-blocked');
}
function blockPointerEventsInCards() {
	cardsContainer.classList.add('pointer-events-blocked');
}
function showError() {
	cardsContainer.innerHTML = `<div class="error-msg">
			<h1>Ha ocurrido un error al cargar el juego</h1>
			<h2> Recarga la página por favor</h2>
		</div>`;
}

function duplicateCards(cardsArr) {
	let arr = [ ...cardsArr, ...cardsArr ];
	return arr;
}

function shuffleCards(cardsArr) {
	//Fisher–Yates shuffle
	let arr = [ ...cardsArr ];
	for (let i = 0; i < cardsArr.length - 2; i++) {
		let random = Math.floor(Math.random() * (cardsArr.length - i) + i);
		[ arr[random], arr[i] ] = [ arr[i], arr[random] ];
	}
	return arr;
}
function positionCards(cardsArr) {
	cardsArr.forEach((card, index) => {
		const cardElement = cardsContainer.children[index];
		cardElement.innerHTML = `
				<img class="card-front" alt="Imagen de carta" src=${card.images.png} >
				<div class="card-back"> </div>
			`;
	});
}
function updateTimeRemaining() {
	let timeContainer = document.getElementById('time');
	let time = parseInt(timeContainer.textContent);
	time--;
	timeContainer.textContent = time.toString();
}

function checkIfTheresARightGuess(lastCard, currentCard) {
	let lastCardFront = lastCard.children[0].src;
	let currentCardFront = currentCard.children[0].src;
	let rightGuess = lastCardFront == currentCardFront;
	if (rightGuess) {
		matchInfo.correctlyGuessedPairs++;
	} else if (!rightGuess) {
		hideFrontOfTheCard(lastCard);
		hideFrontOfTheCard(currentCard);
	}
}

function hideFrontOfTheCard(card) {
	card.classList.remove('is-flipped');
}
function showFrontOfTheCard(card) {
	card.classList.add('is-flipped');
}
function updateAttemptsInScreen(attempts) {
	document.getElementById('attempts').textContent = attempts.toString();
}

function showFinalResult(result) {
	let msg;
	let subMsg;
	if (result === 'victory') {
		msg = '¡Ganaste!';
		subMsg = '¡Refresca la página para volver a jugar e intentar romper tu marca!';
	} else if (result === 'defeat') {
		msg = '¡Se acabó el tiempo!';
		subMsg = 'Refresca la página para volver a jugar';
	}
	document.body.innerHTML = ` 
	<section id="final-result-container" >	
		<div id="final-result" class="appear-effect"> 
			<h1 id="message">${msg}</h1>
			<div id="game-info"> 
				<h4  class="game-info-title">Aciertos</h4>
				<h4 class="game-info-data">${matchInfo.correctlyGuessedPairs.toString()}</h4>
				<h4 class="game-info-title">Intentos</h4>
				<h4 class="game-info-data">${matchInfo.attempts.toString()}</h4> 
				<h4 class="game-info-title">Segundos restantes</h3>
				<h4 class="game-info-data">${document.getElementById('time').textContent}</h4>
			</div>
			<h4 id="sub-message">${subMsg}</h4>
		</div>
	</section>
	`;
}

function finishGameIfTimeIsOver(mutationList) {
	const timeIsOver = mutationList[0].addedNodes[0].textContent === '0';
	if (timeIsOver) {
		clearInterval(myIntervalID);
		showFinalResult('defeat');
	}
}

//Event listeners
cardsContainer.addEventListener('click', (ev) => {
	const aPairIsDefined = matchInfo.currentCard !== undefined && matchInfo.lastCard !== undefined;
	//para evitar que el usuario vea más de 2 cartas a la vez en pantalla:
	if (aPairIsDefined) return;

	if (ev.target.className == 'card-back') {
		const clickedCard = ev.target.parentElement;
		showFrontOfTheCard(clickedCard);
		const lastCardIsUndefined = matchInfo.lastCard === undefined;
		if (lastCardIsUndefined) {
			matchInfo.lastCard = clickedCard;
			return;
		} else {
			matchInfo.currentCard = clickedCard;
		}
	}
});

cardsContainer.addEventListener('transitionend', (ev) => {
	const pairTransitionsEnded = ev.target === matchInfo.currentCard;
	if (pairTransitionsEnded) {
		//para que se evalúe el par solo cuando termine la transición de la segunda carta clickeada
		blockPointerEventsInCards();
		checkIfTheresARightGuess(matchInfo.lastCard, matchInfo.currentCard);
		matchInfo.attempts++;
		updateAttemptsInScreen(matchInfo.attempts);
		matchInfo.resetCurrentAndLastCard();
		allowPointerEventsInCards();
		const victory = matchInfo.correctlyGuessedPairs === 8;
		if (victory) {
			showFinalResult('victory');
			clearInterval(myIntervalID);
		}
	}
});

//Mutation Observer para identificar el momento en que se acaba el tiempo disponible para el jugador
let config = {
	childList: true
};
let observer = new MutationObserver(finishGameIfTimeIsOver);
observer.observe(document.getElementById('time'), config);
