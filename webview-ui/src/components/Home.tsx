import MainBoard from '@webview-ui/components/chat/mainBoard';

interface HomeProps {
	isChatViewHidden: boolean
}

const Home = ({isChatViewHidden}: HomeProps) => {
	return (<>
		<MainBoard isChatViewHidden={isChatViewHidden} />
	</>);
};

export default Home;